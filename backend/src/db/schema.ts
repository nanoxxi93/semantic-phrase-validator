import { pgTable, uuid, varchar, jsonb, numeric, timestamp, index } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

export const phrases = pgTable(
  'phrases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    text: varchar('text', { length: 280 }).notNull(),
    embedding: jsonb('embedding').$type<number[]>().notNull(),
    similarityScore: numeric('similarity_score', { precision: 5, scale: 4 }),
    similarToId: uuid('similar_to_id').references((): AnyPgColumn => phrases.id, { onDelete: 'set null' }),
    validationStatus: varchar('validation_status', { length: 30 }).$type<'UNIQUE' | 'CONFIRMED_DUPLICATE'>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_phrases_created_at_id').on(table.createdAt.desc(), table.id.desc()),
  ]
);

export type Phrase = typeof phrases.$inferSelect;
export type NewPhrase = typeof phrases.$inferInsert;
