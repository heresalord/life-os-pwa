-- Migration: add rating column to books table
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New Query)

ALTER TABLE books ADD COLUMN IF NOT EXISTS rating smallint CHECK (rating >= 1 AND rating <= 5);

-- Verify
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'books' AND column_name = 'rating';
