import { type exampleGetByIdResponse } from "../models/example";
import { LogType, type ILoggerFn } from "../../../src/types";

export const exampleGetById = async (id: number, log: ILoggerFn) => {
  log(LogType.INFO, { id: id });

  let res: exampleGetByIdResponse = {
    name: "This is an example name",
    address: "201 Wannakee Rd",
  };

  return res;
};
