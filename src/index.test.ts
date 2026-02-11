import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { elylog } from "./index";

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
});
