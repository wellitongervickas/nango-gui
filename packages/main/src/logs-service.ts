import type {
  NangoLogsSearchRequest,
  NangoLogsSearchResult,
  NangoLogsMessagesRequest,
  NangoLogsMessagesResult,
  NangoLogOperation,
  NangoLogMessage,
} from "@nango-gui/shared";
import { credentialStore } from "./credential-store.js";
import { getNangoClient, isNangoClientReady } from "./nango-client.js";
import log from "./logger.js";

/**
 * Get the Nango API server URL from the initialized SDK client.
 * Falls back to Nango Cloud if the client is not ready.
 */
function getServerUrl(): string {
  if (isNangoClientReady()) {
    const client = getNangoClient();
    return (client as unknown as { serverUrl: string }).serverUrl;
  }
  return "https://api.nango.dev";
}

function getSecretKey(): string {
  const secretKey = credentialStore.load();
  if (!secretKey) {
    throw Object.assign(
      new Error("Nango API key not configured. Please set your secret key in Settings."),
      { status: 401 },
    );
  }
  return secretKey;
}

async function nangoFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const serverUrl = getServerUrl();
  const secretKey = getSecretKey();
  const url = `${serverUrl}${path}`;

  log.info(`[Logs] ${method} ${path}`);

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secretKey}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    log.error(`[Logs] ${response.status} ${response.statusText}: ${errorBody}`);
    throw Object.assign(
      new Error(`Nango Logs API error: ${response.status} ${response.statusText}`),
      { status: response.status },
    );
  }

  return response.json() as Promise<T>;
}

// ── Nango Logs API response shapes ──────────────────────────────────────

interface RawSearchResponse {
  data: Array<{
    id: string;
    type?: string;
    configId?: number;
    configName?: string;
    connectionId?: string;
    connectionName?: string;
    syncId?: string;
    syncName?: string;
    jobId?: string;
    level?: string;
    environmentId?: number;
    providerName?: string;
    status?: string;
    title?: string;
    message?: string;
    createdAt?: string;
    updatedAt?: string;
    startedAt?: string;
    endedAt?: string;
  }>;
  pagination: {
    cursor?: string | null;
    total?: number;
  };
}

interface RawMessagesResponse {
  data: Array<{
    id: string;
    parentId?: string;
    level?: string;
    type?: string;
    source?: string;
    operationId?: string;
    message?: string;
    createdAt?: string;
    request?: {
      url?: string;
      method?: string;
      headers?: Record<string, string>;
    };
    response?: {
      code?: number;
      headers?: Record<string, string>;
    };
    meta?: Record<string, unknown>;
  }>;
  pagination: {
    cursor?: string | null;
  };
}

function mapOperation(raw: RawSearchResponse["data"][number]): NangoLogOperation {
  return {
    id: raw.id,
    type: (raw.type as NangoLogOperation["type"]) ?? "webhook",
    configId: raw.configId ?? null,
    configName: raw.configName ?? null,
    connectionId: raw.connectionId ?? null,
    connectionName: raw.connectionName ?? null,
    syncId: raw.syncId ?? null,
    syncName: raw.syncName ?? null,
    jobId: raw.jobId ?? null,
    level: (raw.level as NangoLogOperation["level"]) ?? "info",
    environmentId: raw.environmentId ?? 0,
    providerName: raw.providerName ?? null,
    status: (raw.status as NangoLogOperation["status"]) ?? "success",
    title: raw.title ?? null,
    message: raw.message ?? "",
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    startedAt: raw.startedAt ?? null,
    endedAt: raw.endedAt ?? null,
  };
}

function mapMessage(raw: RawMessagesResponse["data"][number]): NangoLogMessage {
  return {
    id: raw.id,
    parentId: raw.parentId ?? null,
    level: (raw.level as NangoLogMessage["level"]) ?? "info",
    type: (raw.type as NangoLogMessage["type"]) ?? "log",
    source: (raw.source as NangoLogMessage["source"]) ?? "internal",
    operationId: raw.operationId ?? "",
    message: raw.message ?? "",
    createdAt: raw.createdAt ?? new Date().toISOString(),
    request: raw.request
      ? {
          url: raw.request.url ?? "",
          method: raw.request.method ?? "",
          headers: raw.request.headers ?? {},
        }
      : undefined,
    response: raw.response
      ? {
          code: raw.response.code ?? 0,
          headers: raw.response.headers ?? {},
        }
      : undefined,
    meta: raw.meta ?? null,
  };
}

export const logsService = {
  async searchOperations(args: NangoLogsSearchRequest): Promise<NangoLogsSearchResult> {
    const body: Record<string, unknown> = {};
    if (args.types?.length) body.types = args.types;
    if (args.status) body.status = args.status;
    if (args.connectionId) body.connectionId = args.connectionId;
    if (args.integrationId) body.integrationId = args.integrationId;
    if (args.period) body.period = args.period;
    if (args.cursor) body.cursor = args.cursor;
    if (args.limit) body.limit = args.limit;

    const raw = await nangoFetch<RawSearchResponse>("POST", "/api/v1/logs/search", body);

    return {
      operations: raw.data.map(mapOperation),
      pagination: {
        cursor: raw.pagination.cursor ?? null,
        total: raw.pagination.total ?? 0,
      },
    };
  },

  async getMessages(args: NangoLogsMessagesRequest): Promise<NangoLogsMessagesResult> {
    const body: Record<string, unknown> = {
      operationId: args.operationId,
    };
    if (args.cursor) body.cursor = args.cursor;
    if (args.limit) body.limit = args.limit;

    const raw = await nangoFetch<RawMessagesResponse>("POST", "/api/v1/logs/search/messages", body);

    return {
      messages: raw.data.map(mapMessage),
      pagination: {
        cursor: raw.pagination.cursor ?? null,
      },
    };
  },
};
