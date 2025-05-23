import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('players', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  name: text('name').notNull(),
})

export const items = sqliteTable('items', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  name: text('name').notNull(),
})
