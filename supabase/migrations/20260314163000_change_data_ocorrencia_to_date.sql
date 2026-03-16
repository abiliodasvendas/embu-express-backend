-- Migration to change data_ocorrencia from TIMESTAMPTZ to DATE
-- This ensures that only the date is stored, avoiding timezone-related shifts.

ALTER TABLE "public"."ocorrencias" 
ALTER COLUMN "data_ocorrencia" TYPE DATE USING "data_ocorrencia"::DATE;
