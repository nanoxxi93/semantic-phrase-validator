CREATE INDEX "idx_phrases_created_at_id" ON "phrases" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
