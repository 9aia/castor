// dbms/player.ts

import { players } from "@/schema";
import { eq } from "drizzle-orm";
import { z, defineBlock } from "./_sdk";

export const listAllPlayers = defineBlock({
  query: db => db.select().from(players)
})

export const listReadyPlayers = defineBlock({
  schema: z.object({ ready: z.boolean() }),
  query: (db, props) => (
    db.select().from(players).where(eq(players.ready, props.ready))
  )
})

export const getPlayerById = defineBlock({
  schema: z.object({ id: z.string() }),
  query: (db, props) => (
    db.select().from(players).where(eq(players.id, props.id))
  ),
});
