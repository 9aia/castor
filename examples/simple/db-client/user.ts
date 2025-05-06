import { block, eq, z } from "@9aia/castor";
import { users } from "../db/schema";

block("List all users", {
  query: db => db.select().from(users)
})

block("Get user by id", {
  schema: z.object({ id: z.string() }),
  query: (db, input) => (
    db.select().from(users).where(eq(users.id, input.id))
  ),
});

block("Insert a user", {
  schema: z.object({
    name: z.string().min(1).max(20),
  }),
  query: (db, input) => (
    db.insert(users).values({
      id: Math.random().toString(36).slice(2),
      name: input.name,
    }).returning()
  ),
});

block("Delete all users", {
  danger: true,
  query: (db, input) => (
    db.delete(users).returning()
  ),
});

