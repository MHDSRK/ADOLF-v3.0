DO $$
DECLARE
  v_config UUID;
  v_conversation_config UUID;
  v_hash_column BOOLEAN;
  v_cron_lock BOOLEAN;
  v_claimed_at_column BOOLEAN;
BEGIN
  SELECT id INTO v_config
  FROM whatsapp_config
  WHERE phone_number_id = '15550000042';

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'migration upgrade lost the WhatsApp config fixture';
  END IF;

  SELECT whatsapp_config_id INTO v_conversation_config
  FROM conversations
  WHERE id = '00000000-0000-0000-0000-000000000442';

  IF v_conversation_config <> v_config THEN
    RAISE EXCEPTION '043 did not backfill conversation.whatsapp_config_id';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'whatsapp_config'
      AND column_name = 'verify_token_hash'
  ) INTO v_hash_column;

  IF NOT v_hash_column THEN
    RAISE EXCEPTION '044 verify_token_hash column is missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'automation_pending_executions'
      AND column_name = 'claimed_at'
  ) INTO v_claimed_at_column;

  IF NOT v_claimed_at_column THEN
    RAISE EXCEPTION '045 automation lease column is missing';
  END IF;

  SELECT public.try_acquire_cron_lock('ci-upgrade-check', 60)
  INTO v_cron_lock;

  IF v_cron_lock IS NOT TRUE THEN
    RAISE EXCEPTION '045 cron lock function could not acquire a lock';
  END IF;
END $$;
