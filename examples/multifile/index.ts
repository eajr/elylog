import { Elysia } from "elysia";

// plugins
import { elylog } from "../../src/index";

// routes
import { ExampleRoutes } from "./routes/example";

const app = new Elysia()
  // plugins
  .use(elylog())

  // routes
  .use(ExampleRoutes)

  .listen(3000);

console.log(
  `🦊 Example API is running at ${app.server?.hostname}:${app.server?.port}`
);
