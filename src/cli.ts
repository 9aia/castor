import type { z } from 'zod'
import type { BlockRegister, Namespace, Registry, Schema } from '~/sdk'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { drizzle } from 'drizzle-orm/d1'
import { getNamespaces } from '~/sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sdkPath = pathToFileURL(path.join(__dirname, './castor-sdk.es.js')).href
const { loadConfig, loadSession, getBlocks, getConfig } = await import(sdkPath)

const { default: enquirer } = await import('enquirer')
const { prompt } = enquirer

// TODO: add `$castor <filepath>` to load a file and run the blocks in it
// TODO: simplify navigation with cancel handling
// TODO: handle subnamespace names
// TODO: add support to dotenv

// TODO: add recently added blocks
// TODO: prune removed blocks from saved json
// TODO: add config for how recent the blocks are considered recent

// TODO: add AI for executing blocks using natural language and prompting for input
// TODO: re-register block before run, and add memo() for preventing re-computation
// TODO: add support for batch result displaying
// TODO: prettify Zod error output
// TODO: refactor to @inquirer/prompts

/* NOTE:
1. How to allow for copying response columns?
2. How to allow for copying response rows?
3. How to allow for copying response cells?
4. Add a way to explore tables, procedures and more?
5. Long horizontal tables should be scrollable?
6. Add dependable blocks?
*/

// #region Db

let db: unknown

// #endregion

async function promptField(fieldName: string, field: unknown) {
  const typeName = (field as any)._def.typeName

  // TODO: display min, max, default, etc.

  if (typeName === 'ZodString') {
    const { value } = await prompt<{ value: string }>({
      type: 'input',
      name: 'value',
      message: `Enter value for ${fieldName} (string):`,
    })
    return value
  }
  else if (typeName === 'ZodNumber') {
    const { value } = await prompt<{ value: number }>({
      type: 'input',
      name: 'value',
      message: `Enter value for ${fieldName} (number):`,
      validate: input => !Number.isNaN(Number(input)) || 'Please enter a valid number',
    })
    return Number(value)
  }
  else if (typeName === 'ZodBoolean') {
    const { value } = await prompt<{ value: string }>({
      type: 'select',
      name: 'value',
      message: `Select value for ${fieldName} (boolean):`,
      choices: [
        { name: 'true' },
        { name: 'false' },
      ],
    })
    return value === 'true'
  }
  else if (typeName === 'ZodArray') {
    // Handle array fields by prompting for values one-by-one or using a special input format
    const { value } = await prompt<{ value: string }>({
      type: 'input',
      name: 'value',
      message: `Enter values for ${fieldName} (comma separated):`,
    })
    return value.split(',').map(item => item.trim())
  }
  else if (typeName === 'ZodEnum') {
    const choices = (field as z.ZodEnum<any>).options.map((option: any) => ({
      name: option,
      value: option,
    }))
    const { value } = await prompt<{ value: string }>({
      type: 'select',
      name: 'value',
      message: `Select value for ${fieldName} (enum):`,
      choices,
    })
    return value
  }
  else if ((field as any)._def.typeName === 'ZodObject') {
    const input: any = {}
    const shape = (field as z.ZodObject<any, any, any>).shape

    for (const [fieldName, field] of Object.entries(shape)) {
      const value = await promptField(fieldName, field)
      input[fieldName] = value
    }

    return input
  }
  else {
    throw new CastorUnsupportedFieldError(typeName)
  }
}

export class CastorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CastorError'
  }
}

export class CastorUnsupportedFieldError extends CastorError {
  constructor(fieldName: string) {
    super(`Unsupported field type: ${fieldName}`)
    this.name = 'CastorUnsupportedFieldError'
  }
}

async function showBlockForm(schema: z.ZodType, lastNamespace?: Namespace) {
  let input: unknown

  try {
    input = await promptField('input', schema)
  }
  catch (err) {
    if (err instanceof CastorUnsupportedFieldError) {
      console.error('❌ Error:', err.message)
      return await showBlocks(getBlocks(), lastNamespace)
    }
    throw err
  }

  const validation = schema.safeParse(input)
  if (!validation.success) {
    // TODO: add validation for each field using the schema
    // TODO: add better error handling with a menu (retry, go back to query, exit Castor)
    console.error('❌ Error validating input:', validation.error.format())
    return await showBlockForm(schema, lastNamespace)
  }

  return input
}

async function renderResult(result: any) {
  // TODO: add column filters
  // TODO: add column actions (copy, delete, edit, etc.)

  const resultArray = Array.isArray(result) ? result : [result]
  // TODO: add page size config
  const PAGE_SIZE = 5 // Number of rows per page

  if (resultArray.length === 0) {
    console.log('No results found.')
    return
  }

  const currentPage = 0
  const totalPages = Math.ceil(resultArray.length / PAGE_SIZE)

  // TODO: create a custom paginator prompt
  async function displayPage(page: number) {
    const start = page * PAGE_SIZE
    const end = start + PAGE_SIZE
    const pageData = resultArray.slice(start, end)

    const hasNextPage = page < totalPages - 1
    const hasPreviousPage = page > 0

    if (hasNextPage || hasPreviousPage) {
      console.log(`Page ${page + 1} of ${totalPages}`)
      console.log(`Showing rows ${start + 1}-${Math.min(end, resultArray.length)} of ${resultArray.length}`)
    }

    console.table(pageData.flat())

    if (!hasNextPage && !hasPreviousPage) {
      return
    }

    const NEXT = '[>]'
    const PREV = '[<]'
    const FIRST = '[1]'
    const LAST = `[${totalPages}]`

    const choices = [
      hasPreviousPage && { name: PREV, value: 'PREV' },
      hasPreviousPage && { name: FIRST, value: 'FIRST' },
      hasNextPage && { name: NEXT, value: 'NEXT' },
      hasNextPage && { name: LAST, value: 'LAST' },
      { name: 'Go to specific page', value: 'SPECIFIC' },
      { name: 'Query menu', value: 'QUERY_AGAIN' },
    ].filter(Boolean) as { name: string, value: string }[]

    const { action } = await prompt<{ action: string }>({
      type: 'select',
      name: 'action',
      message: 'Navigation:',
      choices,
    })

    if (action === NEXT) {
      await displayPage(page + 1)
    }
    else if (action === PREV) {
      await displayPage(page - 1)
    }
    else if (action === FIRST) {
      await displayPage(0)
    }
    else if (action === LAST) {
      await displayPage(totalPages - 1)
    }
    else if (action === 'Go to specific page') {
      const { pageNumber } = await prompt<{ pageNumber: string }>({
        type: 'input',
        name: 'pageNumber',
        message: `Enter page number (1-${totalPages}):`,
        validate: (input) => {
          const num = Number.parseInt(input)
          if (Number.isNaN(num) || num < 1 || num > totalPages) {
            return `Please enter a number between 1 and ${totalPages}`
          }
          return true
        },
      })
      await displayPage(Number.parseInt(pageNumber) - 1)
    }
    else if (action === 'Query menu') {
      // return
    }
  }

  await displayPage(currentPage)
}

async function runBlock<S extends Schema | undefined>(block: BlockRegister<S>, input: unknown) {
  try {
    const parsedInput = block.schema ? block.schema.parse(input) : input

    if (block.query) {
      const result = await block.query?.(db as any, parsedInput)
      await renderResult(result)
    }

    if (block.run) {
      await block.run?.(db as any, parsedInput)
      console.log('Block executed successfully.')
    }
  }
  catch (err) {
    console.error('❌ Error running block: \n\n', err)
  }
}

async function showBlock<S extends Schema | undefined>(
  block: BlockRegister<S>,
  lastInput?: any,
  lastNamespace?: Namespace,
) {
  const input = lastInput ?? (block.schema ? await showBlockForm(block.schema, lastNamespace) : {})

  if (block.danger) {
    const { confirm } = await prompt<{ confirm: boolean }>({
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to run this block?`,
      initial: false,
    })

    if (!confirm) {
      console.log('Block execution cancelled.')
      return showBlocks(getBlocks(), lastNamespace)
    }
  }

  await runBlock(block, input)

  console.log('')

  const choices = [
    block.schema
      ? [
          { name: 'Re-run (same input)', value: 'RERUN_SAME' },
          { name: 'Re-run (new input)', value: 'RERUN_NEW' },
        ]
      : [
          { name: 'Re-run', value: 'RERUN_SAME' },
        ],
    lastNamespace && { name: 'Go back to namespace', value: 'GO_BACK_TO_NAMESPACE' },
    { name: 'Main menu', value: 'MENU' },
  ].filter(Boolean).flat() as { name: string, value: string }[]

  const { action } = await prompt<{ action: string }>({
    type: 'select',
    name: 'action',
    message: 'Choose an action:',
    choices,
  })

  if (action === 'Re-run (same input)' || action === 'Re-run') {
    return await showBlock(block, input, lastNamespace)
  }
  else if (action === 'Re-run (new input)') {
    return await showBlock(block, undefined, lastNamespace)
  }
  else if (action === 'Go back to namespace') {
    return await showNamespace(lastNamespace!)
  }
  else if (action === 'Main menu') {
    return await showMainMenu()
  }
}

async function showBlocks<S extends Schema | undefined>(
  blocks: Registry<S>,
  lastNamespace?: Namespace,
) {
  const { blockName } = await prompt<{ blockName: string }>({
    type: 'select',
    name: 'blockName',
    message: 'Select a block to run',
    choices: blocks.map(b => ({ name: b.name })),
  })

  const block = blocks.find(b => b.name === blockName)!
  await showBlock(block, undefined, lastNamespace)
}

async function showNamespace(namespace: Namespace) {
  console.log('Opening namespace:', namespace.name, `(${namespace.blocks.length} blocks)`, '\n')
  await showBlocks(namespace.blocks, namespace)
}

async function showNamespaces(namespaces: Namespace[]) {
  const { namespaceName } = await prompt<{ namespaceName: string }>({
    type: 'select',
    name: 'namespaceName',
    message: 'Select a namespace to open',
    choices: namespaces.map(n => ({ name: n.name })),
  })

  const namespace = namespaces.find(n => n.name === namespaceName)!
  await showNamespace(namespace)
}

function validateConfigPath(filePath: string | undefined) {
  if (filePath && !fs.existsSync(filePath)) {
    throw new Error('Config file does not exist')
  }
}

async function loadDb() {
  const config = getConfig()

  if (config.dbProvider === 'd1') {
    const wrangler = await import('wrangler')
    const { env } = await wrangler.getPlatformProxy(config.wrangler)
    db = drizzle((env as any)[config.d1.binding], config.drizzle)
    return
  }

  if (typeof config.dbProvider === 'function') {
    db = config.dbProvider()
    return
  }

  throw new Error('Invalid dbProvider. Expected \'d1\' or a function that returns a database instance.')
}

async function showMainMenu(options?: { noMessages?: boolean }) {
  const noMessages = options?.noMessages ?? true

  const namespaces = getNamespaces()
  const blocks = getBlocks()

  if (blocks.length === 0) {
    !noMessages && console.log('No blocks loaded.')
    // NOTE: maybe in the future we must not exit if no blocks are loaded, because we can still open namespaces and take actions on them
    process.exit(0)
  }

  if (!namespaces.length) {
    !noMessages && console.log(`${blocks.length} blocks loaded. No namespaces loaded. 🔗`, '\n')
    await showBlocks(blocks)
    return
  }

  if (namespaces.length > 1) {
    !noMessages && console.log(`${blocks.length} blocks loaded. ${namespaces.length} namespaces loaded. 🔗`, '\n')
    await showNamespaces(namespaces)
    return
  }

  !noMessages && console.log(`${namespaces.length} namespace loaded. 🔗`, '\n')
  await showNamespace(namespaces[0])
}

async function main() {
  try {
    const configIndex = process.argv.indexOf('--config')
    const configPath = configIndex !== -1 ? process.argv[configIndex + 1] : undefined

    validateConfigPath(configPath)

    console.log('🦫  Castor DB Client', '\n')

    await loadConfig(configPath)
    await loadDb()
    await loadSession()

    await showMainMenu({ noMessages: false })
  }
  catch (err) {
    console.error('❌ Error:\n', err)
    process.exit(1)
  }
}

main()
