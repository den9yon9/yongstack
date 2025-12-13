import {
  createInsertSchema as insert,
  createSelectSchema as select,
} from "drizzle-typebox";
import * as schema from "./index";

export const db = {
  insert: {
    user: insert(schema.user),
  },
  select: {
    user: select(schema.user),
  },
};
