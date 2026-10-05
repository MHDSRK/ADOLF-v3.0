-- Representative data fixture used only by CI's migration-upgrade test.
-- It is applied after migration 042 and before 043-045.
DO $$
DECLARE
  v_user UUID := '00000000-0000-0000-0000-000000000042';
  v_account UUID := '00000000-0000-0000-0000-000000000142';
  v_contact UUID := '00000000-0000-0000-0000-000000000242';
  v_config UUID := '00000000-0000-0000-0000-000000000342';
  v_conversation UUID := '00000000-0000-0000-0000-000000000442';
BEGIN
  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data
  )
  VALUES (
    v_user, 'authenticated', 'authenticated', 'migration-fixture@example.com',
    'fixture-password', NOW(), '{}'::jsonb,
    '{"full_name":"Migration Fixture"}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO accounts (id, name, owner_user_id)
  VALUES (v_account, 'Migration Fixture Account', v_user)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO profiles (
    user_id, full_name, email, account_id, account_role
  )
  VALUES (
    v_user, 'Migration Fixture', 'migration-fixture@example.com',
    v_account, 'owner'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET account_id = EXCLUDED.account_id,
      account_role = EXCLUDED.account_role;

  INSERT INTO contacts (
    id, user_id, account_id, phone, name
  )
  VALUES (
    v_contact, v_user, v_account, '+15550000042', 'Migration Fixture Contact'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO whatsapp_config (
    id, user_id, account_id, phone_number_id, waba_id,
    access_token, verify_token, status
  )
  VALUES (
    v_config, v_user, v_account, '15550000042', '155500000142',
    'fixture-access-token', 'fixture-verify-token', 'connected'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO conversations (
    id, user_id, account_id, contact_id, status
  )
  VALUES (
    v_conversation, v_user, v_account, v_contact, 'open'
  )
  ON CONFLICT (id) DO NOTHING;
END $$;
