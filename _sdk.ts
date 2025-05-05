
import * as schema from "@/schema";
import { drizzle } from "drizzle-orm/d1";
import wrangler from "wrangler";
import { UnknownKeysParam, z, ZodRawShape, ZodTypeAny } from "zod";
export { z } from "zod";

// #region Db

const { env } = await wrangler.getPlatformProxy<Env>({ persist: true });

export const db = drizzle(env.DB, { schema })
export type Database = typeof db;

// #endregion

// #region Blocks

export type BlockConfig<T extends z.ZodObject<A, B, C> = any, A extends ZodRawShape = any, B extends UnknownKeysParam = any, C extends ZodTypeAny = any> = {
  schema?: T
  query: (db: Database, props: z.infer<T>) => Promise<any> | any
}

export function defineBlock<T extends z.ZodObject<A, B, C>, A extends ZodRawShape, B extends UnknownKeysParam, C extends ZodTypeAny>(
  config: BlockConfig<T, A, B, C>
) {
  return config;
}

export function isBlockConfig<T extends z.ZodObject<A, B, C>, A extends ZodRawShape, B extends UnknownKeysParam, C extends ZodTypeAny>(
  val: any
): val is BlockConfig<T, A, B, C> {
  return val && typeof val === "object" && "query" in val && typeof val.query === "function";
}

// #endregion
