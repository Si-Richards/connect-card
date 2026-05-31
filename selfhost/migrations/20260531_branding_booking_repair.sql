-- Idempotent repair of the 20260530 branding/booking migration.
-- Safe to run multiple times; never deletes data.
-- Usage: mysql <db> < selfhost/migrations/20260531_branding_booking_repair.sql

-- company_settings columns
SET @db := DATABASE();

-- helper: add column only if missing
-- (executed via dynamic SQL because MySQL lacks ADD COLUMN IF NOT EXISTS pre-8.0.29)

-- company_settings.cover_image_url
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema=@db AND table_name='company_settings' AND column_name='cover_image_url');
SET @sql := IF(@col=0,
  'ALTER TABLE company_settings ADD COLUMN cover_image_url VARCHAR(512) NULL AFTER logo_url',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- company_settings.accent_color
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema=@db AND table_name='company_settings' AND column_name='accent_color');
SET @sql := IF(@col=0,
  'ALTER TABLE company_settings ADD COLUMN accent_color VARCHAR(16) NULL AFTER brand_color',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- employees.brand_color
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema=@db AND table_name='employees' AND column_name='brand_color');
SET @sql := IF(@col=0,
  'ALTER TABLE employees ADD COLUMN brand_color VARCHAR(16) NULL AFTER address',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- employees.accent_color
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema=@db AND table_name='employees' AND column_name='accent_color');
SET @sql := IF(@col=0,
  'ALTER TABLE employees ADD COLUMN accent_color VARCHAR(16) NULL AFTER brand_color',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- employees.logo_url
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema=@db AND table_name='employees' AND column_name='logo_url');
SET @sql := IF(@col=0,
  'ALTER TABLE employees ADD COLUMN logo_url VARCHAR(512) NULL AFTER accent_color',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- employees.cover_image_url
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema=@db AND table_name='employees' AND column_name='cover_image_url');
SET @sql := IF(@col=0,
  'ALTER TABLE employees ADD COLUMN cover_image_url VARCHAR(512) NULL AFTER logo_url',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- employees.booking_url
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema=@db AND table_name='employees' AND column_name='booking_url');
SET @sql := IF(@col=0,
  'ALTER TABLE employees ADD COLUMN booking_url VARCHAR(512) NULL AFTER cover_image_url',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- card_events.event_type enum (always safe to re-assert)
ALTER TABLE card_events
  MODIFY COLUMN event_type ENUM('view','qr_scan','vcard_download','wallet_download','booking_click') NOT NULL;
