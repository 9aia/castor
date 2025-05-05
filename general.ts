import { block, sql } from "./_sdk";

block("Drop all database", {
  danger: true,
  query: db => db.run(sql`
    PRAGMA writable_schema = 1;
    delete from sqlite_master where type in ('table', 'index', 'trigger');
    PRAGMA writable_schema = 0;  
  `)
})

