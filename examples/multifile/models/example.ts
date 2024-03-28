import { t, Static } from "elysia";

const exampleGetByIdResponse = t.Object({
  name: t.String({
    description: "Example name",
    default: "Test Name",
  }),
  address: t.String({
    description: "Example street address",
    default: "123 Main St",
  }),
});

export type exampleGetByIdResponse = Static<typeof exampleGetByIdResponse>;

export { exampleGetByIdResponse };
