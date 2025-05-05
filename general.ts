import { block, sql } from "./_sdk";

block("Drop all database", {
  danger: true,
  query: db => db.run(sql`
    -- Drop all triggers
    SELECT 'DROP TRIGGER IF EXISTS "' || name || '";'
    FROM sqlite_master
    WHERE type = 'trigger';

    -- Drop all indexes (excluding auto indexes)
    SELECT 'DROP INDEX IF EXISTS "' || name || '";'
    FROM sqlite_master
    WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex%';

    -- Drop all tables (excluding system tables)
    SELECT 'DROP TABLE IF EXISTS "' || name || '";'
    FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%';
  `)
})

