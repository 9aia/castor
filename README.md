# 🦫 Castor — Interactive CLI for Database Blocks

**Castor** is a free, open-source, dev-focused database management tool written in Node.js with TypeScript designed for the command line. Think of it as a minimal, scriptable SQL client — built from the ground up for developers who live in the terminal.

It supports a wide range of databases — like MySQL, PostgreSQL and SQLite — but the current prototype focuses on [Cloudflare D1](https://developers.cloudflare.com/d1/) support.

> [!WARNING]
> ⚗️ Experimental — This project is in early stages and under active development. Expect rough edges, missing features, and possibly fast iteration.

## Goals

- 📜 Make database querying scriptable and trackable via source code
- 🔒 Provide type-safe and schema-aware query "blocks" (powered by `zod` and `typescript`)
- ⚡ Load automatically structured query "blocks" from `js`/`ts` files
- 💬 Generate automatically and type-aware prompts in the terminal for input
- 🗂️ Allow the developer to organize queries in folders, version them, track changes with `git`
- 💾 Provide first-class support for `Cloudflare D1` (but with support for providing custom adapters)

## Scope

Castor enables you to:

* 🔌 Connect to your database directly from the terminal
* ✍️ Provide query *block* definition utilities in `.ts`/`.js` files
* 🧠 Run blocks interactively in the terminal, with input prompts

**Out of scope:**

* ❌ GUI or Web UI
* ❌ Query editors or ER diagram tools
* ❌ Export/import utilities
* ❌ Saving queries outside source code

## Features

* ✅ Block discovery from file system
* ✅ Typed CLI prompts using `zod` schemas
* ✅ D1 + `drizzle-orm` integration
* ⚠️ Danger mode prompts
* 📄 Custom configs
* 📝 Run with saved or new input

## Installing

To install Castor, use NPM:

```bash
npm install -D @9aia/castor
```

Or with other package managers like PNPM or Yarn!

## Documentation

// TODO: create a docs website

### Configuring

You can define your own config file using `defineConfig()`:

```ts
//castor.config.ts
import { defineConfig } from "./src/sdk";

export default defineConfig({
  rootDir: "./db-client", // the directory Castor will explore
  source: defaultSource => [...defaultSource, "!**.md"], // exclude MD files
  drizzle: { // DrizzleOptions
    logger: true,
  },
  dbProvider: "d1", 
  d1: {
    binding: "DB",
  },
  wrangler: { // GetPlatformProxyOptions
    persist: true,
  },
});
```

Supports:

* `d1` binding from Wrangler
* Custom `dbProvider` function
* File filters using `fast-glob` patterns

### Defining Sessions

Create files in `db-client/`, like `user.ts`, and export your query blocks there.

### Defining Blocks

Blocks are typed and named operations. They can query or mutate your database:

```ts
// ./db-client/user.ts
import { users } from "~/db/schema";

block("List all users", {
  query: db => db.select().from(users)
})

block("Get user by id", {
  schema: z.object({ id: z.string() }),
  query: (db, input) => (
    db.select().from(users).where(eq(users.id, input.id))
  ),
});

block("Delete all users", {
  danger: true, // will ask for confirmation
  query: (db, input) => (
    db.delete(users)
  ),
});
```

Block signature:

```ts
type Block<S extends Schema | undefined = undefined> = {
  // Mark block as destructive (will ask for confirmation)
  danger?: boolean,
  / Zod schema for validating input
  schema?: S,
  // Async function to return or mutate data
  query?: (db: Database, input: CheckUndefined<S, undefined, z.infer<WithoutUndefined<S>>>) => Promise<any> | any,
  // Async function for operations with side-effects
  run?: (db: Database, input: CheckUndefined<S, undefined, z.infer<WithoutUndefined<S>>>) => Promise<any> | any,
}
```

### Running Castor

Just run it:

```bash
castor

# or with config
castor --config path/to/config.ts
```

You'll see a menu to select and run blocks.

Sample output:

```bash
🦫 Castor DB Client

Blocks loaded: 2

> List all users
> Enter value for limit (number): 10

┌─────────┬──────────────┬──────────────┐
│ (index) │ id           │ name         │
├─────────┼──────────────┼──────────────┤
│ 0       │ 'user_1'     │ 'Alice'      │
│ 1       │ 'user_2'     │ 'Bob'        │
└─────────┴──────────────┴──────────────┘
```

### How It Works

Castor scans your codebase for "blocks" — reusable JS/TS query definitions — and lets you execute them through a guided CLI interface.

Each block can:

* Define a `schema` (input form, type-validated)
* Contain a `query()` or `run()` function using `drizzle-orm`
* Be marked as `danger` (requires confirmation)

It connects to a database (D1 or custom), prompts the user for any necessary input, and runs the logic.

## Developing

### Requirements



## FAQ

**Q: What databases are supported?**
A: Currently Cloudflare D1 (via `wrangler`). You can plug in any db via a `dbProvider()`.

**Q: Can I organize blocks in folders?**
A: Yep. Just drop them anywhere inside `rootDir`, unless excluded via glob.

**Q: What happens when I run a block?**
A: You're prompted for inputs (based on its schema), then Castor runs the logic and prints a table.

## Contribute

Got feedback, ideas, or just want to help shape Castor? Open an issue or send a PR. Contributions are welcome at any stage.

Check out the [contributing guide](./CONTRIBUTING.md) for details.

## Roadmap

If you're curious about Castor's upcoming features or brainstorming sessions, take a look at the comments in the source code.
