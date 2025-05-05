import { players } from "@/schema";
import { eq, z, block } from "./_sdk";

block("List all players", {
  query: db => db.select().from(players)
})

block("List players by ready status", {
  schema: z.boolean(),
  query: (db, input) => (
    db.select().from(players).where(eq(players.ready, input))
  )
})

block("Get player by id", {
  schema: z.object({ id: z.string() }),
  query: (db, input) => (
    db.select().from(players).where(eq(players.id, input.id))
  ),
});
