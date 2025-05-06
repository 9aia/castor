import { drizzle } from "drizzle-orm/d1";
import fs from "node:fs";
import { z } from "zod";
import { BlockRegister, getBlocks, getConfig, loadConfig, loadSessions, Registry, Schema } from "~/sdk";
const { default: enquirer } = await import('enquirer');
const { prompt } = enquirer;

// NOTE:
// 1. How to allow for copying response columns?
// 2. How to allow for copying response rows?
// 3. How to allow for copying response cells?

// NOTE: add a way to explore tables, procedures and more?

// TODO: add a simple example into README

// TODO: re-register block before run, and add memo() for preventing re-computation

// TODO: add recently added blocks
// TODO: add config for how recent the blocks are considered recent
// TODO: add support for folders and list files
// TODO: add AI for executing blocks using natural language and prompting for input
// TODO: add linter
// TODO: refactor to @inquirer/prompts

// TODO: experiment dependable blocks

// #region Db

let db: unknown;

// #endregion

async function promptField(fieldName: string, field: unknown) {
  if (field instanceof z.ZodString) {
    const { value } = await prompt<{ value: string }>({
      type: "input",
      name: "value",
      message: `Enter value for ${fieldName} (string):`
    });
    return value;
  } else if (field instanceof z.ZodNumber) {
    const { value } = await prompt<{ value: number }>({
      type: "input",
      name: "value",
      message: `Enter value for ${fieldName} (number):`,
      validate: (input) => !isNaN(Number(input)) || "Please enter a valid number"
    });
    return Number(value);
  } else if (field instanceof z.ZodBoolean) {
    const { value } = await prompt<{ value: string }>({
      type: "select",
      name: "value",
      message: `Select value for ${fieldName} (boolean):`,
      choices: [
        { name: "true" },
        { name: "false" },
      ]
    });
    return value === "true" ? true : false;
  } else if (field instanceof z.ZodArray) {
    // Handle array fields by prompting for values one-by-one or using a special input format
    const { value } = await prompt<{ value: string }>({
      type: "input",
      name: "value",
      message: `Enter values for ${fieldName} (comma separated):`
    });
    return value.split(",").map(item => item.trim());
  } else if (field instanceof z.ZodEnum) {
    const choices = field.options.map((option: any) => ({
      name: option,
      value: option
    }));
    const { value } = await prompt<{ value: string }>({
      type: "select",
      name: "value",
      message: `Select value for ${fieldName} (enum):`,
      choices
    });
    return value;
  }
  // TODO: Add cases for other types as needed
}

async function showBlockForm(schema: z.ZodType) {
  // TODO: add validation for each field using the schema

  if (schema instanceof z.ZodObject) {
    const input: any = {};
    const shape = (schema as z.ZodObject<any, any, any>).shape;

    for (const [fieldName, field] of Object.entries(shape)) {
      const value = await promptField(fieldName, field);
      input[fieldName] = value
    }

    return input
  }

  const input = await promptField("input", schema);
  const validation = schema.safeParse(input);
  if (!validation.success) {
    // TODO: add better error handling with a menu (retry, go back to query, exit Castor)
    console.error("❌ Error validating input:", validation.error.format());
    return await showBlockForm(schema);
  }
  return input;
}

function renderResult(result: Record<string, any>[]) {
  // TODO: paginate
  // TODO: add column filters
  // TODO: add column actions (copy, delete, etc.)

  if (result.length === 0) {
    console.log("No results found.");
    return;
  }

  console.table(result)
}

async function runBlock<S extends Schema | undefined>(block: BlockRegister<S>, input: unknown) {
  try {
    const parsedInput = block.schema ? block.schema.parse(input) : input;

    if (block.query) {
      const result = await block.query?.(db as any, parsedInput);
      renderResult(result);
    }

    if (block.run) {
      await block.run?.(db as any, parsedInput);
      console.log("Block executed successfully.");
    }
  } catch (err) {
    console.error("❌ Error running block: \n\n", err);
  }
}

async function showBlock<S extends Schema | undefined>(block: BlockRegister<S>, lastInput?: any) {
  const input = lastInput ?? (block.schema ? await showBlockForm(block.schema) : {})

  if (block.danger) {
    const { confirm } = await prompt<{ confirm: boolean }>({
      type: "confirm",
      name: "confirm",
      message: `Are you sure you want to run this block?`,
      initial: false
    });

    if (!confirm) {
      console.log("Block execution cancelled.");
      return showBlocks(getBlocks());
    }
  }

  await runBlock(block, input)

  console.log("")

  let choices = [
    { name: "Re-run (same input)", value: "RERUN_SAME" },
    { name: "Re-run (new input)", value: "RERUN_NEW" },
    { name: "Main menu", value: "MENU" },
    { name: "Exit", value: "EXIT" }
  ]

  if (!block.schema) {
    choices = [
      { name: "Re-run", value: "RERUN_SAME" },
      { name: "Main menu", value: "MENU" },
      { name: "Exit", value: "EXIT" }
    ]
  }
  const { action } = await prompt<{ action: string }>({
    type: "select",
    name: "action",
    message: "Choose an action:",
    choices,
  });

  if (action === "Re-run (same input)" || action === "Re-run") {
    return await showBlock(block, input);
  } else if (action === "Re-run (new input)") {
    return await showBlock(block)
  } else if (action === "Main menu") {
    return await showBlocks(getBlocks());
  } else if (action === "Exit") {
    console.log("Exiting...");
    process.exit(0);
  }
}

async function showBlocks<S extends Schema | undefined>(blocks: Registry<S>) {
  const { blockName } = await prompt<{ blockName: string }>({
    type: "select",
    name: "blockName",
    message: "Select a block to run",
    choices: blocks.map(b => ({ name: b.name }))
  });

  const block = blocks.find(b => b.name === blockName)!;
  await showBlock(block);
}

function validateConfigPath(filePath: string | undefined) {
  if (filePath && !fs.existsSync(filePath)) {
    throw new Error("Config file does not exist");
  }
}

async function loadDb() {
  const config = getConfig();

  if (config.dbProvider === "d1") {
    const wrangler = await import("wrangler");
    const { env } = await wrangler.getPlatformProxy(config.wrangler);
    db = drizzle((env as any)[config.d1.binding], config.drizzle)
    return
  }

  if (typeof config.dbProvider === "function") {
    db = config.dbProvider();
    return
  }

  throw new Error("Invalid dbProvider. Expected 'd1' or a function that returns a database instance.");
}

async function main() {
  try {
    const configIndex = process.argv.indexOf('--config');
    const configPath = configIndex !== -1 ? process.argv[configIndex + 1] : undefined;

    validateConfigPath(configPath);

    console.log("🦫  Castor DB Client", "\n")

    await loadConfig(configPath);
    await loadDb()
    await loadSessions();

    const blocks = getBlocks();

    if (blocks.length === 0) {
      console.log("No session found.");
      process.exit(0);
      return;
    }

    console.log("Blocks loaded:", blocks.length, "\n");

    await showBlocks(blocks)
  } catch (err) {
    console.error("❌ Error:\n", err);
    process.exit(1);
  }
}

main()

