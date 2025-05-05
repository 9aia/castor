
import { z } from "zod";
export * from "drizzle-orm";
export { z } from "zod";
import fg, { Pattern } from "fast-glob";
import path from "node:path";
import fs from "node:fs";

// TODO: improve schema types (must be aligned with the form creator ability)

declare global {
  interface Register {
  }
}

export type Database = Register['database'];

// #region Config

export type Config = {
  rootDir?: string,
  source?: Pattern | Pattern[] | ((defaultSource: Pattern[]) => Pattern[]),
}

export function defineConfig(config: Config) {
  return config;
}

export const DEFAULT_CONFIG: ResolvedConfig = {
  rootDir: "./db-client",
  source: ["**/*.js", "**/*.ts", "!**/_*", "!**/.*"]
}

export type ResolvedConfig = Required<Config> & {
  source: Pattern[]
}

let resolvedConfig: ResolvedConfig

export function getConfig() {
  if(!resolvedConfig) {
    resolvedConfig = DEFAULT_CONFIG;
    return resolvedConfig
  }
  return resolvedConfig;
}

function getResolvedConfig(config?: Config) {
  if (!config) return DEFAULT_CONFIG;

  const resolveSource = (source?: Pattern | Pattern[] | ((defaultSource: Pattern[]) => Pattern[])) => {
    // TODO: validate if source is string or array of strings, but it is checked automatically by fast-glob

    if(typeof config.source === "function") {
      return config.source(DEFAULT_CONFIG.source)
    }

    if(Array.isArray(config.source)) {
      return config.source
    }

    if(!config.source) {
      return DEFAULT_CONFIG.source
    }
    
    return [config.source]
  }

  return {
    ...config,
    rootDir: config.rootDir || DEFAULT_CONFIG.rootDir,
    source: resolveSource(config.source),
  }
}

export async function loadConfig(filePath?: string) {
  const configFile = path.resolve(process.cwd(), filePath || "castor.config.ts")

  if (fs.existsSync(configFile)) {
    const { default: config } = await import(configFile);
    resolvedConfig = getResolvedConfig(config);
  } else {
    console.warn(`Config file not found at \`${path.relative(process.cwd(), configFile)}\`. Using default config.`);
    resolvedConfig = getResolvedConfig();
  }
}

// #endregion

// #region Blocks

export type Block<T extends z.ZodType = any> = {
  name: string,
  description?: string,
  danger?: boolean
  schema?: T
  file?: string
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

export function registerBlock(config: Block, file?: string) {
  // TODO: validate config schema (can't include object values)

  registry.push({ file: config.file || file, ...config });
}

export function getBlocks() {
  return [...registry];
}

export async function loadSessions() {
  const config = getConfig();
  const files = await fg(config.source, { absolute: true, cwd: config.rootDir });

  for (const file of files) {
    await import(file);
  }
}

// #endregion
