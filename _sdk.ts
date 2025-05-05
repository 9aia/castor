
import * as schema from "@/schema";
import { drizzle } from "drizzle-orm/d1";
import wrangler from "wrangler";
import { z } from "zod";
export * from "drizzle-orm";
export { z } from "zod";

// TODO: improve schema types (must be aligned with the form creator ability)

// #region Db

const { env } = await wrangler.getPlatformProxy<Env>({ persist: true });

export const db = drizzle(env.DB, { schema })
export type Database = typeof db;

// #endregion

// #region Blocks

export type BlockConfig<T extends z.ZodType = any> = {
  schema?: T
  query: (db: Database, input: z.infer<T>) => Promise<any> | any
}

export function defineBlock<T extends z.ZodType>(
  config: BlockConfig<T>
) {
  return config;
}

export function isBlockConfig<T extends z.ZodType>(
  val: any
): val is BlockConfig<T> {
  return val && typeof val === "object" && "query" in val && typeof val.query === "function";
}

// #endregion
