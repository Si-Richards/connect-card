-- MFA (TOTP) — required for all users.
-- Existing users get NULL mfa_enrolled_at and are forced to enrol on next login.
-- Idempotent: safe to re-run.

SET @db := DATABASE();

-- users.mfa_secret_enc
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema=@db AND table_name='users' AND column_name='mfa_secret_enc');
SET @sql := IF(@col=0,
  'ALTER TABLE users ADD COLUMN mfa_secret_enc VARBINARY(512) NULL AFTER password_hash',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- users.mfa_enrolled_at
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema=@db AND table_name='users' AND column_name='mfa_enrolled_at');
SET @sql := IF(@col=0,
  'ALTER TABLE users ADD COLUMN mfa_enrolled_at TIMESTAMP NULL AFTER mfa_secret_enc',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- user_mfa_recovery_codes table
CREATE TABLE IF NOT EXISTS user_mfa_recovery_codes (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  user_id     CHAR(36)     NOT NULL,
  code_hash   VARCHAR(255) NOT NULL,
  used_at     TIMESTAMP    NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_recovery_user (user_id),
  CONSTRAINT fk_recovery_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
