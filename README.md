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
* ❌ Block versioning or saving queries outside source code (use `git` for that)
* ❌ Agnostic data validation (use `zod` for now)

## Features

* ✅ Block discovery from file system
* ✅ Typed CLI prompts using `zod` schemas
* ✅ `Cloudflare D1` + `drizzle-orm` integration
* ⚠️ Danger mode prompts
* 📄 Custom configs
* 📝 Run with saved or new input

## Installing

To install Castor, use NPM:

```bash
npm install -D @9aia/castor
```

Or with other package managers like PNPM or Yarn!

### Adding the database type to Castor

Castor needs to know the type of your database. You can do this by adding a `types.d.ts` file to your project:

```ts
// types.d.ts
import { Database } from '~/lib/db'

declare module '@9aia/castor' {
  interface Register {
    database: Database
  }
}

export {}
```

### Adding the Script to your `package.json` (Recommended)

Add the `db:client` script to your `package.json`:

```json
// package.json
{
  "scripts": {
    "db:client": "castor --config path/to/config.ts"
  }
}
```

## Documentation

### Configuring

You can define your own config file using `defineConfig()`:

```ts
import type { Database } from '~/'
// castor.config.ts
import { defineConfig } from '@9aia/castor'
export default defineConfig({
  rootDir: './db-client', // the directory Castor will explore
  source: defaultSource => [...defaultSource, '!**.md'], // exclude MD files
  drizzle: { // DrizzleOptions
    logger: true,
  },
  dbProvider: 'd1',
  d1: {
    binding: 'DB',
  },
  wrangler: { // GetPlatformProxyOptions
    persist: true,
  },
})
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
import { block } from '@9aia/castor'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '~/db/schema'

block('List all users', {
  query: db => db.select().from(users)
})

block('Get user by id', {
  schema: z.object({ id: z.string() }),
  query: (db, input) => (
    db.select().from(users).where(eq(users.id, input.id))
  ),
})

block('Delete all users', {
  danger: true, // will ask for confirmation
  query: (db, input) => (
    db.delete(users)
  ),
})
```

Block config signature:

```ts
interface BlockConfig<S extends Schema | undefined = undefined> {
  // Mark block as destructive (will ask for confirmation)
  danger?: boolean
  // Zod schema for validating input
  schema?: S
  // Async function to return or mutate data
  query?: (db: ProvidedDatabase, input: InferBlockFnInput<S>) => Promise<any> | any
  // Async function for operations with side-effects
  run?: (db: ProvidedDatabase, input: InferBlockFnInput<S>) => Promise<any> | any
}
```

### Running Castor

Just run it:

```bash
castor

# or with config
castor --config path/to/config.ts

# or with a script (recommended)
pnpm db:client
```

You'll see a menu to select and run blocks.

Sample output:

```bash
🦫  Castor DB Client

Config file not found at `castor.config.ts`. Using default config.
6 blocks loaded. 2 namespaces loaded. 🔗

✔ Select a namespace to open · user
Opening namespace: user (5 blocks)

✔ Select a block to run · List all users
Page 1 of 30
Showing rows 1-5 of 150
┌─────────┬───────────────┬──────────┐
│ (index) │ id            │ name     │
├─────────┼───────────────┼──────────┤
│ 0       │ 'dj2bh08yf2s' │ 'User 1' │
│ 1       │ 'xizda46r5m8' │ 'User 2' │
│ 2       │ 'il6qpw38j6'  │ 'User 3' │
│ 3       │ 'l3uoalp72o8' │ 'User 4' │
│ 4       │ 'eprfnwls63g' │ 'User 5' │
└─────────┴───────────────┴──────────┘
? Navigation: …
▸ [>]
  [30]
  Go to specific page
  Query menu
```

### How It Works

Castor scans your codebase for "blocks" — reusable JS/TS query definitions — and lets you execute them through a guided CLI interface.

Each block can:

* Define a `schema` (input form, type-validated)
* Contain a `query()` and/or `run()` function using `drizzle-orm`
* Be marked as `danger` (destructive and will ask for confirmation)

It connects to a database (D1 or custom), prompts the user for any necessary input, runs the logic and prints the result.

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
