import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { elylog, LogType, type IOptions } from "./index";

type HookContext = {
  store: Record<string, unknown>;
  request: Request;
  path: string;
};

const createContext = (
  input: string = "http://localhost/api/ping",
  method: string = "GET",
  headers?: Record<string, string>,
): HookContext => ({
  store: {},
  request: new Request(input, { method, headers }),
  path: new URL(input).pathname,
});

const getHooks = (options?: IOptions) => {
  const plugin = elylog(options) as any;

  return {
    deriveHook: plugin.event.transform[0].fn as (ctx: HookContext) => {
      log: (type: LogType, data: object) => void;
    },
    requestHook: plugin.event.request[0].fn as (ctx: HookContext) => void,
    beforeHandleHook: plugin.event.beforeHandle[0].fn as (ctx: HookContext) => void,
    afterResponseHook: plugin.event.afterResponse[0].fn as (ctx: HookContext) => void,
  };
};

describe("elylog", () => {
  it("registers cleanly with the node adapter", async () => {
    const createApp = () =>
      new Elysia({
        adapter: node(),
        prefix: "/api",
      })
        .use(
          elylog({
            requestPrintFn: () => {},
            metadataPrintFn: () => {},
            logPrintFn: () => {},
          }),
        )
        .get("/ping", () => "pong");

    expect(createApp).not.toThrow();
    const app = createApp();

    const res = await app.handle(new Request("http://localhost/api/ping"));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("pong");
  });

  it("uses request header id when configured", () => {
    const requestLogs: any[] = [];
    const { requestHook, beforeHandleHook } = getHooks({
      headerForRequestId: "x-request-id",
      requestPrintFn: (log) => requestLogs.push(log),
      metadataPrintFn: () => {},
      logPrintFn: () => {},
    });
    const ctx = createContext("http://localhost/api/ping", "GET", {
      "x-request-id": "client-request-id",
    });

    requestHook(ctx);
    beforeHandleHook(ctx);

    expect(ctx.store.elylogRequestId).toBe("client-request-id");
    expect(typeof ctx.store.elylogRequestStart).toBe("bigint");
    expect(requestLogs).toHaveLength(1);
    expect(requestLogs[0].uuid).toBe("client-request-id");
    expect(requestLogs[0].method).toBe("GET");
    expect(requestLogs[0].path).toBe("/api/ping");
    expect(requestLogs[0].type).toBe(LogType.SYSTEM);
    expect(requestLogs[0].timestamp).toBeInstanceOf(Date);
  });

  it("generates request id when configured header is missing", () => {
    const requestLogs: any[] = [];
    const { requestHook, beforeHandleHook } = getHooks({
      headerForRequestId: "x-request-id",
      requestPrintFn: (log) => requestLogs.push(log),
      metadataPrintFn: () => {},
      logPrintFn: () => {},
    });
    const ctx = createContext();

    requestHook(ctx);
    beforeHandleHook(ctx);

    const generatedId = String(ctx.store.elylogRequestId);
    expect(generatedId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(requestLogs).toHaveLength(1);
    expect(requestLogs[0].uuid).toBe(generatedId);
  });

  it("does not emit request logs when logRequests is disabled", () => {
    const requestLogs: any[] = [];
    const { requestHook, beforeHandleHook } = getHooks({
      logRequests: false,
      requestPrintFn: (log) => requestLogs.push(log),
      metadataPrintFn: () => {},
      logPrintFn: () => {},
    });
    const ctx = createContext();

    requestHook(ctx);
    beforeHandleHook(ctx);

    expect(requestLogs).toHaveLength(0);
  });

  it("emits application log messages with request uuid", () => {
    const messageLogs: any[] = [];
    const { deriveHook } = getHooks({
      requestPrintFn: () => {},
      metadataPrintFn: () => {},
      logPrintFn: (log) => messageLogs.push(log),
    });
    const ctx = createContext();

    ctx.store.elylogRequestId = "req-123";
    const { log } = deriveHook(ctx);
    log(LogType.INFO, { event: "test" });
    log(LogType.WARNING, { event: "warn" });
    log(LogType.ERROR, { event: "error" });

    expect(messageLogs).toHaveLength(3);
    expect(messageLogs[0]).toMatchObject({
      type: LogType.INFO,
      uuid: "req-123",
      data: { event: "test" },
    });
    expect(messageLogs[1]).toMatchObject({
      type: LogType.WARNING,
      uuid: "req-123",
      data: { event: "warn" },
    });
    expect(messageLogs[2]).toMatchObject({
      type: LogType.ERROR,
      uuid: "req-123",
      data: { event: "error" },
    });
    expect(messageLogs[0].timestamp).toBeInstanceOf(Date);
  });

  it("emits metadata logs with request duration", () => {
    const metadataLogs: any[] = [];
    const { afterResponseHook } = getHooks({
      requestPrintFn: () => {},
      metadataPrintFn: (log) => metadataLogs.push(log),
      logPrintFn: () => {},
    });
    const ctx = createContext();

    ctx.store.elylogRequestId = "req-meta";
    ctx.store.elylogRequestStart = process.hrtime.bigint() - BigInt(5_000_000);
    afterResponseHook(ctx);

    expect(metadataLogs).toHaveLength(1);
    expect(metadataLogs[0]).toMatchObject({
      type: LogType.METADATA,
      uuid: "req-meta",
    });
    expect(metadataLogs[0].duration).toBeGreaterThanOrEqual(0);
    expect(metadataLogs[0].timestamp).toBeInstanceOf(Date);
  });

  it("does not emit metadata when logMetaData is disabled", () => {
    const metadataLogs: any[] = [];
    const { afterResponseHook } = getHooks({
      logMetaData: false,
      requestPrintFn: () => {},
      metadataPrintFn: (log) => metadataLogs.push(log),
      logPrintFn: () => {},
    });
    const ctx = createContext();

    ctx.store.elylogRequestId = "req-meta-off";
    ctx.store.elylogRequestStart = process.hrtime.bigint() - BigInt(1_000_000);
    afterResponseHook(ctx);

    expect(metadataLogs).toHaveLength(0);
  });

  it("default printers send expected output to console", () => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const logCalls: string[] = [];
    const warnCalls: string[] = [];
    const errorCalls: string[] = [];

    console.log = ((msg: string) => {
      logCalls.push(msg);
    }) as typeof console.log;
    console.warn = ((msg: string) => {
      warnCalls.push(msg);
    }) as typeof console.warn;
    console.error = ((msg: string) => {
      errorCalls.push(msg);
    }) as typeof console.error;

    try {
      const { deriveHook, requestHook, beforeHandleHook, afterResponseHook } = getHooks();
      const ctx = createContext();

      requestHook(ctx);
      beforeHandleHook(ctx);

      const { log } = deriveHook(ctx);
      log(LogType.INFO, { event: "info" });
      log(LogType.WARNING, { event: "warn" });
      log(LogType.ERROR, { event: "error" });

      afterResponseHook(ctx);

      expect(logCalls.length).toBeGreaterThanOrEqual(3);
      expect(warnCalls).toHaveLength(1);
      expect(errorCalls).toHaveLength(1);

      const parsedLogTypes = logCalls.map((entry) => JSON.parse(entry).type);
      expect(parsedLogTypes).toContain(LogType.SYSTEM);
      expect(parsedLogTypes).toContain(LogType.INFO);
      expect(parsedLogTypes).toContain(LogType.METADATA);
      expect(JSON.parse(warnCalls[0]).type).toBe(LogType.WARNING);
      expect(JSON.parse(errorCalls[0]).type).toBe(LogType.ERROR);
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  });
});
