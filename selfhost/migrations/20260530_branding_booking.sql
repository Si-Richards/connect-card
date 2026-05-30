-- Branding overrides, booking link, booking_click event
-- Run against MySQL: mysql <db> < selfhost/migrations/20260530_branding_booking.sql

ALTER TABLE company_settings
  ADD COLUMN cover_image_url VARCHAR(512) NULL AFTER logo_url,
  ADD COLUMN accent_color VARCHAR(16) NULL AFTER brand_color;

ALTER TABLE employees
  ADD COLUMN brand_color VARCHAR(16) NULL AFTER address,
  ADD COLUMN accent_color VARCHAR(16) NULL AFTER brand_color,
  ADD COLUMN logo_url VARCHAR(512) NULL AFTER accent_color,
  ADD COLUMN cover_image_url VARCHAR(512) NULL AFTER logo_url,
  ADD COLUMN booking_url VARCHAR(512) NULL AFTER cover_image_url;

ALTER TABLE card_events
  MODIFY COLUMN event_type ENUM('view','qr_scan','vcard_download','wallet_download','booking_click') NOT NULL;
