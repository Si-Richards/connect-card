-- Business Card — MySQL 8 schema
-- All UUIDs stored as CHAR(36). No RLS — enforce in app code.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  display_name    VARCHAR(255) NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  user_id         CHAR(36)     NOT NULL,
  role            ENUM('admin','moderator','user') NOT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_role (user_id, role),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employees (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  slug            VARCHAR(255) NOT NULL UNIQUE,
  full_name       VARCHAR(255) NOT NULL,
  job_title       VARCHAR(255) NULL,
  company         VARCHAR(255) NULL,
  email           VARCHAR(255) NULL,
  office_phone    VARCHAR(64)  NULL,
  mobile          VARCHAR(64)  NULL,
  website         VARCHAR(512) NULL,
  linkedin        VARCHAR(512) NULL,
  notes           TEXT         NULL,
  photo_url       VARCHAR(512) NULL,
  disabled        TINYINT(1)   NOT NULL DEFAULT 0,
  view_count      INT          NOT NULL DEFAULT 0,
  created_by      CHAR(36)     NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_employees_disabled (disabled)
);

CREATE TABLE IF NOT EXISTS company_settings (
  id              TINYINT(1)   NOT NULL DEFAULT 1 PRIMARY KEY,
  company_name    VARCHAR(255) NULL DEFAULT 'Your Company',
  brand_color     VARCHAR(16)  NULL DEFAULT '#0f172a',
  logo_url        VARCHAR(512) NULL,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_singleton CHECK (id = 1)
);

INSERT IGNORE INTO company_settings (id) VALUES (1);

-- Per-event analytics. Aggregate view_count on employees is kept for fast display.
CREATE TABLE IF NOT EXISTS card_events (
  id              CHAR(36)     NOT NULL PRIMARY KEY,
  employee_id     CHAR(36)     NOT NULL,
  event_type      ENUM('view','qr_scan','vcard_download','wallet_download') NOT NULL,
  user_agent      VARCHAR(512) NULL,
  referrer        VARCHAR(512) NULL,
  ip_hash         CHAR(64)     NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_events_employee (employee_id, created_at),
  INDEX idx_events_type (event_type, created_at),
  CONSTRAINT fk_events_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
