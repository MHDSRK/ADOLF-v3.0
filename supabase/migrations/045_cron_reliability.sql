-- ============================================================
-- 045_cron_reliability
--
-- Make scheduled workers safe under at-least-once delivery and process
-- crashes:
--   * automation pending rows get a lease timestamp + attempt count;
--   * stale running rows become claimable again;
--   * a small DB lock prevents two scheduler invocations from sweeping
--     the same workload at once.
-- ============================================================

ALTER TABLE automation_pending_executions
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_automation_pending_claimed
  ON automation_pending_executions(claimed_at)
  WHERE status = 'running';

CREATE TABLE IF NOT EXISTS cron_locks (
  name TEXT PRIMARY KEY,
  locked_until TIMESTAMPTZ NOT NULL DEFAULT 'epoch'::timestamptz,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cron_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE cron_locks FROM anon, authenticated;
GRANT ALL ON TABLE cron_locks TO service_role;

CREATE OR REPLACE FUNCTION public.try_acquire_cron_lock(
  p_name TEXT,
  p_ttl_seconds INTEGER DEFAULT 240
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acquired BOOLEAN := FALSE;
BEGIN
  INSERT INTO cron_locks (name, locked_until, updated_at)
  VALUES (
    p_name,
    NOW() + make_interval(secs => GREATEST(p_ttl_seconds, 30)),
    NOW()
  )
  ON CONFLICT (name) DO UPDATE
  SET locked_until = NOW() + make_interval(secs => GREATEST(p_ttl_seconds, 30)),
      updated_at = NOW()
  WHERE cron_locks.locked_until <= NOW()
  RETURNING TRUE INTO acquired;

  RETURN COALESCE(acquired, FALSE);
END;
$$;

ALTER FUNCTION public.try_acquire_cron_lock(TEXT, INTEGER) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.try_acquire_cron_lock(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_acquire_cron_lock(TEXT, INTEGER) TO service_role;
