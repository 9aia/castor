import type { DrizzleConfig } from 'drizzle-orm'
import type { Pattern } from 'fast-glob'
import type { GetPlatformProxyOptions } from 'wrangler'
import type { z } from 'zod'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import fg from 'fast-glob'

// TODO: improve schema types (must be aligned with the form creator ability)

declare global {
  var __castorRegistry: BlockRegister<any>[]
  var __castorNamespaces: Namespace[]
  var __castorCwf: string | undefined
  namespace Castor {
    interface Register {
      database?: any
    }
  }
}

export type Database = Castor.Register['database']

// #region Config

export interface Config {
  rootDir?: string
  source?: Pattern | Pattern[] | ((defaultSource: Pattern[]) => Pattern[])
  drizzle?: DrizzleConfig
  dbProvider?: 'd1' | (() => Promise<Database> | Database)
  wrangler?: GetPlatformProxyOptions
  d1?: {
    binding: string
  }
}

export function defineConfig(config: Config) {
  return config
}

export const DEFAULT_CONFIG: ResolvedConfig = {
  rootDir: './db-client',
  source: ['**/*.js', '**/*.ts', '!**/_*', '!**/.*'],
  dbProvider: 'd1',
  wrangler: {
    persist: true,
  },
  d1: {
    binding: 'DB',
  },
}

export interface ResolvedConfig {
  rootDir: string
  source: Pattern[]
  drizzle?: Config['drizzle']
  dbProvider: 'd1' | (() => Promise<Database> | Database)
  wrangler: GetPlatformProxyOptions
  d1: {
    binding: string
  }
}

let resolvedConfig: ResolvedConfig

export function getConfig(): ResolvedConfig {
  if (!resolvedConfig) {
    resolvedConfig = DEFAULT_CONFIG
    return resolvedConfig
  }
  return resolvedConfig
}

function getResolvedConfig(config?: Config) {
  if (!config)
    return DEFAULT_CONFIG

  const resolveSource = (source?: Pattern | Pattern[] | ((defaultSource: Pattern[]) => Pattern[])) => {
    // TODO: validate if source is string or array of strings, but it is checked automatically by fast-glob

    if (typeof source === 'function') {
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
    }
  }

  const resolveD1 = (d1Config: Config['d1']) => {
    const d1 = d1Config || DEFAULT_CONFIG.d1

    if (!d1.binding) {
      d1.binding = DEFAULT_CONFIG.d1.binding
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
  const configFile = path.resolve(process.cwd(), filePath || 'castor.config.ts')

  if (fs.existsSync(configFile)) {
    const { default: config } = await import(configFile)
    resolvedConfig = getResolvedConfig(config)
  }
  else {
    console.warn(`Config file not found at \`${path.relative(process.cwd(), configFile)}\`. Using default config.`)
    resolvedConfig = getResolvedConfig()
  }
}

// #endregion

// #region Blocks

export type Schema = z.ZodType

type WithoutUndefined<T> = T extends undefined ? never : T
type CheckUndefined<T, V, F> = [T] extends [undefined] ? V : F

export interface Block<S extends Schema | undefined = undefined> {
  name: string
  description?: string
  danger?: boolean
  schema?: S
  file?: string
  query?: (db: Database, input: CheckUndefined<S, undefined, z.infer<WithoutUndefined<S>>>) => Promise<any> | any
  run?: (db: Database, input: CheckUndefined<S, undefined, z.infer<WithoutUndefined<S>>>) => Promise<any> | any
}

export function block<S extends Schema | undefined = undefined>(
  name: string,
  config: Omit<Block<S>, 'name'>,
) {
  const file = globalThis.__castorCwf
  registerBlock({ name, ...config as any }, file)
  return config
}

export function isBlock<S extends Schema | undefined = undefined>(
  val: any,
): val is Block<S> {
  return val && typeof val === 'object' && 'query' in val && typeof val.query === 'function'
}

// #endregion

// #region Registry

export type BlockRegister<S extends Schema | undefined> = Block<S> & {
  name: string
}

export type Registry<S extends Schema | undefined> = BlockRegister<S>[]

if (!globalThis.__castorRegistry) {
  globalThis.__castorRegistry = []
}

export function registerBlock<S extends Schema | undefined>(config: Block<S>, file?: string) {
  // TODO: validate config schema (can't include object values)
  globalThis.__castorRegistry.push({ file: config.file || file, ...config })
}

export function getBlocks<S extends Schema | undefined>() {
  return [...globalThis.__castorRegistry] as Registry<S>
}

// #endregion

// #region Namespaces

export interface Namespace {
  name: string
  file?: string
  blocks: BlockRegister<any>[]
}

if (!globalThis.__castorNamespaces) {
  globalThis.__castorNamespaces = []
}

export function registerNamespace(namespace: Namespace) {
  globalThis.__castorNamespaces.push(namespace)
}

export function getNamespaces() {
  return [...globalThis.__castorNamespaces]
}

// NOTE: should we add `namespace(config)`?

export function loadNamespaces() {
  // TODO: add virtual namespace

  for (const block of getBlocks()) {
    if (!block.file)
      continue

    const namespace = globalThis.__castorNamespaces.find(namespace => namespace.file === block.file)
    if (namespace) {
      namespace.blocks.push(block)
    }
    else {
      const namespaceName = path.basename(block.file, path.extname(block.file))
      registerNamespace({
        name: namespaceName,
        file: block.file,
        blocks: [block],
      })
    }
  }
}

export async function loadSession() {
  const config = getConfig()
  const files = await fg(config.source, { absolute: true, cwd: config.rootDir })

  for (const file of files) {
    globalThis.__castorCwf = file
    await import(file)
  }

  globalThis.__castorCwf = undefined

  loadNamespaces()
}

// #endregion
