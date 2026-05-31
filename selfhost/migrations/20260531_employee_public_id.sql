-- Add unguessable public_id to employees.
-- Idempotent: safe to re-run.

-- 1. Add column if missing
SET @col := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'employees' AND column_name = 'public_id'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE employees ADD COLUMN public_id VARCHAR(32) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Backfill any NULLs with random base64url-ish strings (16 bytes -> ~22 chars)
UPDATE employees
SET public_id = LOWER(
  REPLACE(REPLACE(REPLACE(TO_BASE64(RANDOM_BYTES(16)), '+', ''), '/', ''), '=', '')
)
WHERE public_id IS NULL OR public_id = '';

-- 3. Enforce NOT NULL + unique index (idempotent)
SET @idx := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'employees' AND index_name = 'idx_employees_public_id'
);
SET @sql := IF(@idx = 0,
  'CREATE UNIQUE INDEX idx_employees_public_id ON employees(public_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE employees MODIFY COLUMN public_id VARCHAR(32) NOT NULL;
