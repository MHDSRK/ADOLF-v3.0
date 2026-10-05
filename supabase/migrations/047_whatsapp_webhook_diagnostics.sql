-- ============================================================
-- 047_whatsapp_webhook_diagnostics
--
-- Minimal delivery ledger for debugging Meta -> ADOLF webhook delivery.
-- No message bodies, contact names, or phone numbers are stored.
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_webhook_deliveries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  payload_hash      text NOT NULL,
  waba_id           text,
  fields            text[] NOT NULL DEFAULT '{}',
  phone_number_ids  text[] NOT NULL DEFAULT '{}',
  message_ids       text[] NOT NULL DEFAULT '{}',
  status_ids        text[] NOT NULL DEFAULT '{}',
  outcome           text NOT NULL DEFAULT 'received'
                    CHECK (outcome IN ('received', 'processed', 'failed')),
  error_message     text
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_deliveries_received_at
  ON whatsapp_webhook_deliveries(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_deliveries_payload_hash
  ON whatsapp_webhook_deliveries(payload_hash);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_deliveries_phone_number_ids
  ON whatsapp_webhook_deliveries USING GIN(phone_number_ids);

ALTER TABLE whatsapp_webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- This table is diagnostic infrastructure and is intentionally service-role
-- only. The application admin client is the only writer/reader.
