import { pgTable, uuid, varchar, jsonb, numeric, timestamp } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

export const phrases = pgTable('phrases', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: varchar('text', { length: 280 }).notNull(),
  embedding: jsonb('embedding').$type<number[]>().notNull(),
  similarity_score: numeric('similarity_score', { precision: 5, scale: 4 }),
  similar_to_id: uuid('similar_to_id').references((): AnyPgColumn => phrases.id, { onDelete: 'set null' }),
  validation_status: varchar('validation_status', { length: 30 }).$type<'UNIQUE' | 'CONFIRMED_DUPLICATE'>().notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Phrase = typeof phrases.$inferSelect;
export type NewPhrase = typeof phrases.$inferInsert;
