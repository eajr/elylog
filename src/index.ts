import { Elysia, type Context } from "elysia";
import { randomUUID } from "node:crypto";
import {
  LogType,
  type LogMessage,
  type LogMetaData,
  type LogRequest,
  type IOptions,
  type ILoggerFn,
} from "./types";

// re-export types
export * from "./types";

const defaultOptions: IOptions = {
  headerForRequestId: undefined,
  logRequests: true,
  logMetaData: true,
  requestPrintFn: (log: LogRequest) => {
    console.log(JSON.stringify(log));
  },
  logPrintFn: (log: LogMessage) => {
    switch (log.type) {
      case LogType.INFO:
        return console.log(JSON.stringify(log));
      case LogType.WARNING:
        return console.warn(JSON.stringify(log));
      case LogType.ERROR:
        return console.error(JSON.stringify(log));
    }
  },
  metadataPrintFn: (log: LogMetaData) => {
    console.log(JSON.stringify(log));
  },
};

// Main plugin
export const elylog = (options?: IOptions) => {
  if (options === undefined) options = defaultOptions;
  else options = { ...defaultOptions, ...options };

  return new Elysia({
    name: "@eajr/elylog",
  })
    .derive((ctx) => {
      const raw = (type: LogType, data: object) => {
        let log: LogMessage = {
          timestamp: new Date(),
          type: type,
          uuid: (ctx.store as any).elylogRequestId,
          data: data,
        };
        options?.logPrintFn?.(log);
      };
      const logger: ILoggerFn = (type: LogType, data: object) => {
        raw(type, data);
      };

      return {
        log: logger,
      };
    })
    .onRequest((ctx) => {
      let reqId: string | null = null;
      if (options?.headerForRequestId !== undefined)
        reqId = ctx.request.headers.get(options?.headerForRequestId);

      if (reqId === null) reqId = randomUUID();

      ctx.store = {
        ...ctx.store,
        elylogRequestStart: process.hrtime.bigint(),
        elylogRequestId: reqId,
      };
    })
    .onBeforeHandle((ctx) => {
      if (options?.logRequests) {
        const log: LogRequest = {
          timestamp: new Date(),
          type: LogType.SYSTEM,
          uuid: (ctx.store as any).elylogRequestId,
          method: ctx.request.method,
          path: ctx.path,
        };

        options?.requestPrintFn?.(log);
      }
    })
    .onResponse(onResponse(options))
    .onError((ctx) => {});
};

const onResponse = (options: IOptions) => {
  return (ctx: Context) => {
    if (options?.logMetaData) {
      const reqStart = (ctx.store as any).elylogRequestStart;
      const reqEnd = process.hrtime.bigint();

      const log: LogMetaData = {
        timestamp: new Date(),
        type: LogType.METADATA,
        uuid: (ctx.store as any).elylogRequestId,
        duration: Number(durationToMilliseconds(reqStart, reqEnd)),
      };

      options?.metadataPrintFn?.(log);
    }
  };
};

function durationToMilliseconds(start: bigint, end: bigint) {
  return (end - start) / BigInt(1000000);
}
