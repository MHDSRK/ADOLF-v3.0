-- ============================================================
-- 046_ai_reply_idempotency
--
-- Prevent concurrent webhook retries for the same inbound WhatsApp
-- message from generating/sending multiple AI replies.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_reply_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  inbound_message_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE (account_id, inbound_message_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_reply_claims_conversation
  ON ai_reply_claims(conversation_id, claimed_at DESC);

ALTER TABLE ai_reply_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE ai_reply_claims FROM anon, authenticated;
GRANT ALL ON TABLE ai_reply_claims TO service_role;
