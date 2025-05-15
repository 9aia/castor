import { block } from '@9aia/castor'
import { items } from '../db/schema'

block('List all items', {
  query: db => db.select().from(items),
})
