import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { AnyD1Database } from 'drizzle-orm/d1'
import type * as schema from './db/schema'

export type Database = DrizzleD1Database<typeof schema> & { $client: AnyD1Database }

declare global {
  namespace Castor {
    interface Register {
      database: Database
    }
  }
}

export {}
