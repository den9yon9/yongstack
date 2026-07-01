import Elysia from "elysia";
import { fileModel } from "./model";

export const file = new Elysia().use(fileModel);
