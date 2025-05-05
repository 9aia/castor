
import { z } from "zod";
export * from "drizzle-orm";
export { z } from "zod";
import fg from "fast-glob";

// TODO: improve schema types (must be aligned with the form creator ability)

declare global {
  interface Register {
  }
}

export type Database = Register['database'];

// #region Blocks

export type Block<T extends z.ZodType = any> = {
  name: string,
  description?: string,
  danger?: boolean
  schema?: T
  query: (db: Database, input: z.infer<T>) => Promise<any> | any
}

export function block<T extends z.ZodType>(
  name: string,
  config: Omit<Block<T>, "name">
) {
  registerBlock({ name, ...config })
  return config;
}

export function isBlock<T extends z.ZodType>(
  val: any
): val is Block<T> {
  return val && typeof val === "object" && "query" in val && typeof val.query === "function";
}

// #endregion

// #region Registry

export type BlockRegister = Block & {
  name: string
}

export const registry: BlockRegister[] = [];

export function registerBlock(config: Block) {
  // TODO: validate config schema (can't include object values)

  registry.push(config);
}

export function getBlocks() {
  return [...registry];
}

// Load all dbms/**/*.ts blocks dynamically
export async function loadBlocks() {
  const files = await fg(["./dbms/**/*.ts", "!dbms/**/_*.ts", "!dbms/**/.*"], { absolute: true });

  for (const file of files) {
    await import(file);
  }
}

// #endregion
