
import * as schema from "@/schema";
import { drizzle } from "drizzle-orm/d1";
import wrangler from "wrangler";
import { z } from "zod";
import { BlockRegister, getBlocks, loadBlocks, registry } from "./_sdk";

// NOTE:
// 1. How to allow for copying response columns?
// 2. How to allow for copying response rows?
// 3. How to allow for copying response cells?

// TODO: add config (how recent the blocks are considered recent, session directory path)
// TODO: add recently added blocks
// TODO: add AI for block execution with natural language
// TODO: add support for folders and list files
// TODO: fix not autorized queries
// TODO: experiment registering blocks without exports (using inner register call in `defineBlock()`)

const { default: enquirer } = await import('enquirer');
const { prompt } = enquirer;

// #region Db

const { env } = await wrangler.getPlatformProxy<Env>({ persist: true });

export const db = drizzle(env.DB, { schema })

declare global {
  interface Register {
    database: typeof db;
  }
}

// #endregion

export async function runBlockByName(name: string, input: unknown) {
  const found = registry.find(b => b.name === name);
  if (!found) throw new Error(`Block "${name}" not found.`);
  const parsed = found.schema ? found.schema.parse(input) : input;
  return await found.query?.(db, parsed);
}

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
    // TODO: add better error handling with a menu (retry, go back to query, exit DBMS)
    console.error("❌ Error validating input:", validation.error.format());
    return showBlockForm(schema);
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

async function showBlock(block: BlockRegister, lastInput?: any) {
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

  try {
    const result = await runBlockByName(block.name, input);
    renderResult(result);
  } catch (err) {
    console.error("❌ Error running block:", err);
  }

  console.log("")

  const { action } = await prompt<{ action: string }>({
    type: "select",
    name: "action",
    message: "What do you want to do next?",
    choices: [
      { name: "Re-run" },
      { name: "Re-run from scratch" },
      { name: "Menu" },
      { name: "Exit" }
    ]
  });

  if (action === "Re-run") {
    return showBlock(block, input);
  } else if (action === "Re-run from scratch") {
    return showBlock(block)
  } else if (action === "Menu") {
    return showBlocks(getBlocks());
  } else {
    console.log("Exiting...");
    process.exit(0);
  }
}

async function showBlocks(blocks: BlockRegister[]) {
  const { blockName } = await prompt<{ blockName: string }>({
    type: "select",
    name: "blockName",
    message: "Select a block to run",
    choices: blocks.map(b => ({ name: b.name }))
  });

  const block = blocks.find(b => b.name === blockName)!;
  showBlock(block);
}

async function main() {
  await loadBlocks();

  const blocks = getBlocks();

  if (blocks.length === 0) {
    console.log("No blocks found.");
    return;
  }

  console.log("Blocks loaded:", blocks.length, "\n");

  showBlocks(blocks)
}

main();
