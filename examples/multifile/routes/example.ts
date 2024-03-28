import { Elysia, t } from "elysia";
import { exampleGetById } from "../handlers/example";
import { exampleGetByIdResponse } from "../models/example";
import { elylog } from "../../../src/index";

export const ExampleRoutes = new Elysia()
  .use(elylog())
  .get("/:id", ({ params: { id }, log }) => exampleGetById(id, log), {
    params: t.Object({
      id: t.Numeric(),
    }),
    response: exampleGetByIdResponse,
    detail: {
      summary: "Get Example by ID",
      description: "An example GET request",
      tags: ["ExampleTag"],
    },
  });
