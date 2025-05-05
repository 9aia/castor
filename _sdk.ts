
import { z } from "zod";
import fg, { Pattern } from "fast-glob";
import path from "node:path";
import fs from "node:fs";
import { db } from "~/middleware";
import { GetPlatformProxyOptions } from "wrangler";

export * from "drizzle-orm";
export { z } from "zod";

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
  dbProvider?: "d1" | (() => Promise<Database> | Database),
  wrangler?: GetPlatformProxyOptions,
  d1?: {
    binding: string,
  }
}

export function defineConfig(config: Config) {
  return config;
}

export const DEFAULT_CONFIG: ResolvedConfig = {
  rootDir: "./db-client",
  source: ["**/*.js", "**/*.ts", "!**/_*", "!**/.*"],
  dbProvider: "d1",
  wrangler: {
    persist: true, 
  },
  d1: {
    binding: "DB",
  }
}

export type ResolvedConfig = Required<Config> & {
  source: Pattern[]
}

let resolvedConfig: ResolvedConfig

export function getConfig() {
  if (!resolvedConfig) {
    resolvedConfig = DEFAULT_CONFIG;
    return resolvedConfig
  }
  return resolvedConfig;
}

function getResolvedConfig(config?: Config) {
  if (!config) return DEFAULT_CONFIG;

  const resolveSource = (source?: Pattern | Pattern[] | ((defaultSource: Pattern[]) => Pattern[])) => {
    // TODO: validate if source is string or array of strings, but it is checked automatically by fast-glob

    if (typeof source === "function") {
      return source(DEFAULT_CONFIG.source)
    }

    if (Array.isArray(source)) {
      return source
    }

    if (!source) {
      return DEFAULT_CONFIG.source
    }

    return [source]
  }

  const resolveWrangler = (wranglerConfig: Config['wrangler'] = DEFAULT_CONFIG.wrangler) => {
    return {
      ...DEFAULT_CONFIG.wrangler,
      ...wranglerConfig,
    };
  };

  const resolveD1 = (d1Config: Config['d1']) => {
    const d1 = d1Config || DEFAULT_CONFIG.d1;
  
    if(!d1.binding) {
      d1.binding = DEFAULT_CONFIG.d1.binding;
    }

    return d1
  }

  return {
    ...config,
    rootDir: config.rootDir || DEFAULT_CONFIG.rootDir,
    source: resolveSource(config.source),
    dbProvider: config.dbProvider || DEFAULT_CONFIG.dbProvider,
    wrangler: resolveWrangler(config.wrangler),
    d1: resolveD1(config.d1),
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

export type Schema = z.ZodType

type WithoutUndefined<T> = T extends undefined ? never : T;
type CheckUndefined<T, V, F> = [T] extends [undefined] ? V : F;

export type Block<S extends Schema | undefined = undefined> = {
  name: string,
  description?: string,
  danger?: boolean,
  schema?: S,
  file?: string,
  query?: (db: Database, input: CheckUndefined<S, undefined, z.infer<WithoutUndefined<S>>>) => Promise<any> | any,
  run?: (db: Database, input: CheckUndefined<S, undefined, z.infer<WithoutUndefined<S>>>) => Promise<any> | any,
}

export function block<S extends Schema | undefined = undefined>(
  name: string,
  config: Omit<Block<S>, "name">
) {
  registerBlock({ name, ...config as any });
  return config;
}

export function isBlock<S extends Schema | undefined = undefined>(
  val: any
): val is Block<S> {
  return val && typeof val === "object" && "query" in val && typeof val.query === "function";
}

// #endregion

// #region Registry

export type BlockRegister<S extends Schema | undefined> = Block<S> & {
  name: string
}

export type Registry<S extends Schema | undefined> = BlockRegister<S>[]

const registry: BlockRegister<any>[] = [];

export function registerBlock<S extends Schema | undefined>(config: Block<S>, file?: string) {
  // TODO: validate config schema (can't include object values)

  registry.push({ file: config.file || file, ...config });
}

export function getBlocks<S extends Schema | undefined>() {
  return [...registry] as Registry<S>;
}

export async function loadSessions() {
  const config = getConfig();
  const files = await fg(config.source, { absolute: true, cwd: config.rootDir });

  for (const file of files) {
    await import(file);
  }
}

// #endregion
