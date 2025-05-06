import * as schema from "./db/schema";
import { DrizzleD1Database, type AnyD1Database } from "drizzle-orm/d1";

export type Database = DrizzleD1Database<typeof schema> & { $client: AnyD1Database };

declare global {
  namespace Castor {
    interface Register {
      database: Database
    }
  }
}

export {}
