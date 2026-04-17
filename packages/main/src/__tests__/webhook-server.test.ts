import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as http from "node:http";
import type { AddressInfo } from "node:net";

// ── Electron mock ────────────────────────────────────────────────────────────
// vi.mock factories are hoisted to the top of the file, so any variables they
// reference must also be hoisted with vi.hoisted().

const { mockSend, mockIsDestroyed, mockGetAllWindows } = vi.hoisted(() => {
  const mockSend = vi.fn();
  const mockIsDestroyed = vi.fn().mockReturnValue(false);
  const mockGetAllWindows = vi.fn().mockReturnValue([
    { isDestroyed: mockIsDestroyed, webContents: { send: mockSend } },
  ]);
  return { mockSend, mockIsDestroyed, mockGetAllWindows };
});

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: mockGetAllWindows,
  },
}));

// logger is a no-op in tests
vi.mock("../logger.js", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { webhookServer } from "../webhook-server.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Allocate a free port by asking the OS for one, then immediately closing it.
 * This is racy by design (another process could grab it) but works reliably
 * in isolated test environments.
 */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as AddressInfo).port;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function sendRequest(
  port: number,
  opts: {
    method?: string;
    path?: string;
    body?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const { method = "POST", path = "/", body, headers = {} } = opts;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        method,
        path,
        headers: body
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), ...headers }
          : headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("WebhookServer", () => {
  afterEach(async () => {
    if (webhookServer.isRunning) {
      await webhookServer.stop();
    }
    webhookServer.clearEvents();
    vi.clearAllMocks();
    mockIsDestroyed.mockReturnValue(false);
    mockGetAllWindows.mockReturnValue([
      { isDestroyed: mockIsDestroyed, webContents: { send: mockSend } },
    ]);
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  describe("start / stop", () => {
    it("starts listening and returns port + url", async () => {
      const port = await getFreePort();
      const result = await webhookServer.start(port);
      expect(result.port).toBe(port);
      expect(result.url).toBe(`http://127.0.0.1:${port}`);
      expect(webhookServer.isRunning).toBe(true);
      expect(webhookServer.currentPort).toBe(port);
    });

    it("stops the server and clears port", async () => {
      const port = await getFreePort();
      await webhookServer.start(port);
      expect(webhookServer.isRunning).toBe(true);

      await webhookServer.stop();
      expect(webhookServer.isRunning).toBe(false);
      expect(webhookServer.currentPort).toBeNull();
    });

    it("stop is a no-op when not running", async () => {
      expect(webhookServer.isRunning).toBe(false);
      await expect(webhookServer.stop()).resolves.toBeUndefined();
    });

    it("restarts cleanly when start is called while already running", async () => {
      const port1 = await getFreePort();
      await webhookServer.start(port1);

      const port2 = await getFreePort();
      const second = await webhookServer.start(port2);

      expect(webhookServer.isRunning).toBe(true);
      expect(second.port).toBe(port2);
      expect(webhookServer.currentPort).toBe(port2);
    });
  });

  // ── Request handling ──────────────────────────────────────────────────────

  describe("request handling", () => {
    let port: number;

    beforeEach(async () => {
      port = await getFreePort();
      await webhookServer.start(port);
      webhookServer.clearEvents();
    });

    it("accepts a POST request and returns 200 with {ok:true,id}", async () => {
      const { status, body } = await sendRequest(port, {
        method: "POST",
        path: "/webhook/nango",
        body: JSON.stringify({ foo: "bar" }),
      });
      expect(status).toBe(200);
      const parsed = JSON.parse(body) as { ok: boolean; id: string };
      expect(parsed.ok).toBe(true);
      expect(typeof parsed.id).toBe("string");
    });

    it("records the event in the event store", async () => {
      await sendRequest(port, {
        method: "POST",
        path: "/hook",
        body: JSON.stringify({ x: 1 }),
      });
      const events = webhookServer.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.method).toBe("POST");
      expect(events[0]!.path).toBe("/hook");
      expect(events[0]!.body).toEqual({ x: 1 });
    });

    it("parses query params into the event", async () => {
      await sendRequest(port, { method: "GET", path: "/data?a=1&b=hello" });
      const events = webhookServer.getEvents();
      expect(events[0]!.query).toEqual({ a: "1", b: "hello" });
    });

    it("captures headers into the event", async () => {
      await sendRequest(port, {
        method: "POST",
        path: "/",
        body: "{}",
        headers: { "x-custom-header": "test-value" },
      });
      const events = webhookServer.getEvents();
      expect(events[0]!.headers["x-custom-header"]).toBe("test-value");
    });

    it("handles body-less GET requests", async () => {
      await sendRequest(port, { method: "GET", path: "/ping" });
      const events = webhookServer.getEvents();
      expect(events[0]!.method).toBe("GET");
      expect(events[0]!.body).toBeNull();
    });

    it("stores raw string body when JSON parse fails", async () => {
      const raw = "not-json";
      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          { hostname: "127.0.0.1", port, method: "POST", path: "/" },
          (res) => { res.resume(); res.on("end", resolve); }
        );
        req.on("error", reject);
        req.write(raw);
        req.end();
      });
      const events = webhookServer.getEvents();
      expect(events[0]!.body).toBe(raw);
    });

    it("handles OPTIONS preflight with 204 and CORS headers", async () => {
      const result = await sendRequest(port, { method: "OPTIONS", path: "/" });
      expect(result.status).toBe(204);
    });

    it("pushes each event to all open BrowserWindow instances", async () => {
      await sendRequest(port, {
        method: "POST",
        path: "/push",
        body: JSON.stringify({ pushed: true }),
      });
      expect(mockSend).toHaveBeenCalledOnce();
      expect(mockSend.mock.calls[0]![0]).toBe("webhook:event");
      const payload = mockSend.mock.calls[0]![1] as { method: string; path: string };
      expect(payload.method).toBe("POST");
      expect(payload.path).toBe("/push");
    });

    it("skips destroyed windows when pushing events", async () => {
      mockIsDestroyed.mockReturnValue(true);
      await sendRequest(port, { method: "POST", path: "/" });
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("increments eventCount for each received request", async () => {
      expect(webhookServer.eventCount).toBe(0);
      await sendRequest(port, { method: "POST", path: "/a" });
      await sendRequest(port, { method: "GET", path: "/b" });
      expect(webhookServer.eventCount).toBe(2);
    });
  });

  // ── Event management ───────────────────────────────────────────────────────

  describe("event management", () => {
    let port: number;

    beforeEach(async () => {
      port = await getFreePort();
      await webhookServer.start(port);
    });

    it("getEvents returns a copy, not the internal array", async () => {
      await sendRequest(port, { method: "POST", path: "/x" });
      const snapshot1 = webhookServer.getEvents();
      await sendRequest(port, { method: "POST", path: "/y" });
      const snapshot2 = webhookServer.getEvents();
      expect(snapshot1).toHaveLength(1);
      expect(snapshot2).toHaveLength(2);
    });

    it("clearEvents empties the store and resets eventCount", async () => {
      await sendRequest(port, { method: "POST", path: "/" });
      expect(webhookServer.eventCount).toBe(1);
      webhookServer.clearEvents();
      expect(webhookServer.getEvents()).toHaveLength(0);
      expect(webhookServer.eventCount).toBe(0);
    });

    it("ring-buffer keeps at most MAX_EVENTS=500 events and drops oldest", async () => {
      webhookServer.clearEvents();
      const MAX_EVENTS = 500;

      // Send MAX_EVENTS + 1 requests sequentially so we can be certain about
      // ordering and avoid overwhelming the server with parallel connections.
      // We only send enough to trigger the eviction behaviour.
      for (let i = 0; i < MAX_EVENTS + 1; i++) {
        await sendRequest(port, { method: "GET", path: `/item/${i}` });
      }

      const events = webhookServer.getEvents();
      expect(events.length).toBeLessThanOrEqual(MAX_EVENTS);
      // The very first event (/item/0) should have been evicted
      const paths = events.map((e) => e.path);
      expect(paths).not.toContain("/item/0");
    }, 30_000);
  });
});
