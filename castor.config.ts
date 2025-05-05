import { Database } from "~/lib/db";
import { defineConfig } from "./_sdk";

export default defineConfig({})

declare global {
  interface Register {
    database: Database
  }
}
