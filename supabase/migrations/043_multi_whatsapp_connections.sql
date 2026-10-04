-- ============================================================
-- 043_multi_whatsapp_connections.sql
--
-- Allow one account to connect multiple WhatsApp phone numbers
-- without losing the channel identity of an existing conversation.
--
-- Invariants:
--   * phone_number_id is globally unique in this CRM instance.
--   * every existing conversation is backfilled to the account's
--     pre-043 WhatsApp config when one exists.
--   * new conversations may only share a contact when they belong
--     to the same WhatsApp config.
--   * deleting a config preserves conversation/message history;
--     the conversation's channel becomes NULL and can no longer
--     be used for outbound WhatsApp until a new conversation is
--     opened on a connected number.
-- ============================================================

-- The account-wide one-number invariant is no longer valid.
ALTER TABLE whatsapp_config
  DROP CONSTRAINT IF EXISTS whatsapp_config_account_id_key;

-- A Meta phone number may belong to only one CRM account/config.
-- Keep this database-enforced so concurrent connection attempts
-- cannot create ambiguous inbound webhook routing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_config_phone_number_id_key'
  ) THEN
    ALTER TABLE whatsapp_config
      ADD CONSTRAINT whatsapp_config_phone_number_id_key
      UNIQUE (phone_number_id);
  END IF;
END $$;

-- Pin each conversation to the WhatsApp connection that owns its
-- inbound/outbound channel. Nullable only for historical rows whose
-- account no longer has a saved WhatsApp config.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS whatsapp_config_id UUID
  REFERENCES whatsapp_config(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp_config
  ON conversations(whatsapp_config_id);

-- Before 043 there was at most one config per account, so the correct
-- migration for every existing conversation is unambiguous.
UPDATE conversations c
SET whatsapp_config_id = wc.id
FROM whatsapp_config wc
WHERE c.account_id = wc.account_id
  AND c.whatsapp_config_id IS NULL;

-- Migration 036 enforced one conversation per account/contact. That
-- invariant is too strong once one customer can chat with two business
-- numbers. Replace it with one conversation per account/contact/channel.
DROP INDEX IF EXISTS idx_conversations_account_contact;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_account_contact_channel
  ON conversations(account_id, contact_id, whatsapp_config_id)
  WHERE whatsapp_config_id IS NOT NULL;

-- Broadcasts are initiated outbound, so they also need an explicit
-- sending connection. Existing broadcasts inherit the account's old
-- single config where possible; NULL remains valid for drafts created
-- before a number was connected.
ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS whatsapp_config_id UUID
  REFERENCES whatsapp_config(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_broadcasts_whatsapp_config
  ON broadcasts(whatsapp_config_id);

UPDATE broadcasts b
SET whatsapp_config_id = wc.id
FROM whatsapp_config wc
WHERE b.account_id = wc.account_id
  AND b.whatsapp_config_id IS NULL;

COMMENT ON COLUMN conversations.whatsapp_config_id IS
  'WhatsApp connection/channel used by this conversation. NULL only when the historical connection was removed.';

COMMENT ON COLUMN broadcasts.whatsapp_config_id IS
  'WhatsApp connection selected for this outbound broadcast.';
