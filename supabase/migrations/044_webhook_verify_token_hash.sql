-- ============================================================
-- 044_webhook_verify_token_hash
--
-- Make Meta webhook verification O(log n) instead of scanning every
-- whatsapp_config row and decrypting every token.
--
-- The hash is an HMAC derived from ENCRYPTION_KEY, so plaintext verify
-- tokens remain out of the database. Existing rows are intentionally
-- left NULL; the application performs a one-time legacy fallback and
-- backfills the hash synchronously when that row is successfully verified.
-- ============================================================

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS verify_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_verify_token_hash
  ON whatsapp_config(verify_token_hash)
  WHERE verify_token_hash IS NOT NULL;

COMMENT ON COLUMN whatsapp_config.verify_token_hash IS
  'HMAC-SHA256 lookup key for the encrypted Meta webhook verification token.';
