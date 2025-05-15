import { block } from '@9aia/castor'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../db/schema'

block('List all users', {
  query: db => db.select().from(users),
})

block('Get user by id', {
  schema: z.object({ id: z.string() }),
  query: (db, input) => (
    db.select().from(users).where(eq(users.id, input.id))
  ),
})

block('Insert a user', {
  schema: z.object({
    name: z.string().min(1).max(20),
  }),
  query: (db, input) => (
    db.insert(users).values({
      id: Math.random().toString(36).slice(2),
      name: input.name,
    }).returning()
  ),
})

block('Insert X users', {
  schema: z.number().min(1).max(90),
  query: (db, input) => {
    const inserts = Array.from({ length: input }, (_, i) =>
      db.insert(users).values({
        id: Math.random().toString(36).slice(2),
        name: `User ${i + 1}`,
      }))
    return db.batch(inserts as any)
  },
})

block('Delete all users', {
  danger: true,
  query: db => (
    db.delete(users).returning()
  ),
})
