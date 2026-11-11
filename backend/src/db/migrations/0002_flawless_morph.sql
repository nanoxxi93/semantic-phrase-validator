DROP INDEX "idx_phrases_created_at_id";--> statement-breakpoint
ALTER TABLE "phrases" ADD COLUMN "embedding_model" varchar(150) DEFAULT 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_phrases_model_created_at_id" ON "phrases" USING btree ("embedding_model","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
