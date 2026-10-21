CREATE TABLE "phrases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" varchar(280) NOT NULL,
	"embedding" jsonb NOT NULL,
	"similarity_score" numeric(5, 4),
	"similar_to_id" uuid,
	"validation_status" varchar(30) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "phrases" ADD CONSTRAINT "phrases_similar_to_id_phrases_id_fk" FOREIGN KEY ("similar_to_id") REFERENCES "public"."phrases"("id") ON DELETE set null ON UPDATE no action;