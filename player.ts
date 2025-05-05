// dbms/player.ts

import { players } from "@/schema";
import { eq, z, defineBlock } from "./_sdk";

export const listAllPlayers = defineBlock({
  query: db => db.select().from(players)
})

export const listReadyPlayers = defineBlock({
  schema: z.array(z.string()),
  query: (db, input) => (
    db.select().from(players).where(eq(players.ready, input))
  )
})

export const getPlayerById = defineBlock({
  schema: z.object({ id: z.string() }),
  query: (db, input) => (
    db.select().from(players).where(eq(players.id, input.id))
  ),
});
