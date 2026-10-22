-- ==============================================================================
-- Semantic Phrase Validator - Esquema DDL Consolidado e Idempotente (PostgreSQL 17)
-- ==============================================================================
-- Este script permite inicializar o actualizar la estructura de la base de datos
-- de forma autónoma, sin depender de utilidades de Node.js, TypeScript ni Drizzle Kit.
-- Es seguro ejecutarlo múltiples veces consecutivas (idempotente).
--
-- Uso con cliente psql local:
--   psql -h localhost -U postgres -d semantic_phrases -f scripts/schema.sql
--
-- Uso mediante Docker sin psql instalado en la máquina anfitriona:
--   docker exec -i semantic_phrases_postgres psql -U postgres -d semantic_phrases < scripts/schema.sql
-- ==============================================================================

-- 1. Habilitar extensión pgcrypto para generación defensiva de UUIDs v4 si aplica
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Creación de la tabla principal de frases y embeddings semánticos
CREATE TABLE IF NOT EXISTS "phrases" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "text" varchar(280) NOT NULL,
    "embedding" jsonb NOT NULL,
    "similarity_score" numeric(5, 4),
    "similar_to_id" uuid,
    "validation_status" varchar(30) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. Definición idempotente de la clave foránea reflexiva sobre similar_to_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'phrases_similar_to_id_phrases_id_fk'
    ) THEN
        ALTER TABLE "phrases"
        ADD CONSTRAINT "phrases_similar_to_id_phrases_id_fk"
        FOREIGN KEY ("similar_to_id")
        REFERENCES "public"."phrases"("id")
        ON DELETE SET NULL
        ON UPDATE NO ACTION;
    END IF;
END $$;

-- 4. Creación idempotente del índice compuesto descendente para paginación de alta escala
CREATE INDEX IF NOT EXISTS "idx_phrases_created_at_id"
ON "phrases" USING btree ("created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
