import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
  type Server,
} from "node:http";
import { randomUUID } from "node:crypto";
import { BrowserWindow } from "electron";
import { IPC_CHANNELS } from "@nango-gui/shared";
import type { WebhookEvent } from "@nango-gui/shared";
import log from "./logger.js";

const MAX_EVENTS = 500;
const DEFAULT_PORT = 3456;

class WebhookServer {
  private server: Server | null = null;
  private port: number | null = null;
  private events: WebhookEvent[] = [];

  get isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  get currentPort(): number | null {
    return this.port;
  }

  get eventCount(): number {
    return this.events.length;
  }

  getEvents(): WebhookEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }

  async start(port: number = DEFAULT_PORT): Promise<{ port: number; url: string }> {
    if (this.isRunning) {
      await this.stop();
    }

    return new Promise((resolve, reject) => {
      const server = createServer(
        (req: IncomingMessage, res: ServerResponse) => {
          void this.handleRequest(req, res);
        }
      );

      server.on("error", (err: Error) => {
        log.error("[Webhook] Server error:", err);
        reject(err);
      });

      server.listen(port, "127.0.0.1", () => {
        this.server = server;
        const addr = server.address() as { port: number };
        const actualPort = addr.port;
        this.port = actualPort;
        log.info(`[Webhook] Listening on http://127.0.0.1:${actualPort}`);
        resolve({ port: actualPort, url: `http://127.0.0.1:${actualPort}` });
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise((resolve) => {
      this.server!.close(() => {
        this.server = null;
        this.port = null;
        log.info("[Webhook] Server stopped");
        resolve();
      });
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Handle CORS preflight
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "*");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const body = await this.readBody(req);
      const base = `http://127.0.0.1:${this.port}`;
      const url = new URL(req.url ?? "/", base);

      const query: Record<string, string> = {};
      url.searchParams.forEach((v, k) => {
        query[k] = v;
      });

      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === "string") headers[k] = v;
        else if (Array.isArray(v)) headers[k] = v.join(", ");
      }

      const event: WebhookEvent = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        method: req.method ?? "GET",
        path: url.pathname,
        query,
        headers,
        body,
      };

      // Ring buffer — drop oldest when at capacity
      if (this.events.length >= MAX_EVENTS) {
        this.events.shift();
      }
      this.events.push(event);

      // Push to all open renderer windows
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.WEBHOOK_EVENT, event);
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, id: event.id }));
    } catch (err) {
      log.error("[Webhook] Request handler error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Internal error" }));
    }
  }

  private readBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf-8");
        if (!raw) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(raw) as unknown);
        } catch {
          resolve(raw);
        }
      });
      req.on("error", () => resolve(null));
    });
  }
}

export const webhookServer = new WebhookServer();
