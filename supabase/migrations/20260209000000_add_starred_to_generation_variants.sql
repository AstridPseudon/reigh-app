ALTER TABLE "generation_variants" ADD COLUMN "starred" boolean DEFAULT false NOT NULL;
CREATE INDEX "idx_generation_variants_starred" ON "generation_variants" USING btree ("starred");
