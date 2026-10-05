'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { SettingsPanelHead } from './settings-panel-head';
import type { WhatsAppConfig as WhatsAppConfigType } from '@/types';

const MASKED_TOKEN = '••••••••••••••••';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';
type ResetReason = 'token_corrupted' | 'meta_api_error' | null;

// Meta ids are decimal digit strings — mirrors the server-side check in
// POST /api/whatsapp/config so the obvious paste mistakes get a named
// field before a round-trip.
const META_ID_RE = /^\d+$/;

// `meta` object the config route attaches to every failed Meta call
// (issue #505): what a user quotes to Meta support.
type MetaErrorMeta = {
  code: number | null;
  subcode: number | null;
  fbtrace_id: string | null;
  step: string;
  field?: string | null;
  message?: string | null;
};
type MetaFailure = { message: string; meta: MetaErrorMeta | null };
type WabaSubscription = {
  checked: boolean;
  subscribed: boolean | null;
  app_id_match: boolean | null;
  error?: string;
};

export function WhatsAppConfig() {
  const t = useTranslations('Settings.whatsapp');
  const supabase = createClient();
  // After multi-user, whatsapp_config is one-row-per-account, not
  // one-row-per-user. We pull `accountId` straight off the auth
  // context and key every read off it — so a teammate who just
  // joined an account sees the inviter's saved config without
  // having to re-enter anything.
  const {
    user,
    accountId,
    loading: authLoading,
    profileLoading,
    canEditSettings,
  } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [configs, setConfigs] = useState<WhatsAppConfigType[]>([]);
  const [connectionNames, setConnectionNames] = useState<Record<string, string>>({});
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [isAddingConnection, setIsAddingConnection] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfigType | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  // Structured details of the last failed Meta call (health check or
  // save) — rendered as small muted text under the actionable message.
  const [statusMeta, setStatusMeta] = useState<MetaErrorMeta | null>(null);
  const [saveFailure, setSaveFailure] = useState<MetaFailure | null>(null);
  const [wabaSubscription, setWabaSubscription] = useState<WabaSubscription | null>(null);
  // Guards against re-hydrating the form when the load effect below
  // re-runs for reasons unrelated to actually switching accounts —
  // e.g. Supabase's onAuthStateChange fires a token refresh (new
  // `user` object, profileLoading flips true/false) when the browser
  // tab regains focus. Without this, that churn calls fetchConfig()
  // again and overwrites whatever the user typed but hadn't saved yet.
  const loadedAccountIdRef = useRef<string | null>(null);
  const nameLookupIdsRef = useRef(new Set<string>());

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [pin, setPin] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);
  const [verifyEdited, setVerifyEdited] = useState(false);

  // Inbound-media mirror (issue #466). Unlike everything else on this
  // page it is NOT part of handleSave: that path insists on re-entering
  // the access token so it can re-verify with Meta, which is a silly
  // toll to pay for flipping a boolean. The switch writes straight to
  // the row instead — RLS (migration 017) restricts whatsapp_config
  // UPDATE to admins, hence the canEditSettings gate below; without it
  // a viewer's toggle would match zero rows and appear to work.
  const [mirrorMedia, setMirrorMedia] = useState(true);
  const [savingMirror, setSavingMirror] = useState(false);

  // True once /register has succeeded on Meta's side (timestamp set
  // in the row). When false, the saved config is metadata-only and
  // Meta will silently drop every inbound event — that's the
  // multi-number bug that prompted this work.
  const isRegistered = Boolean(config?.registered_at);
  const lastRegistrationError = config?.last_registration_error ?? null;

  const [verifyingRegistration, setVerifyingRegistration] = useState(false);
  type RegistrationProbe = {
    live: boolean;
    checks: Record<string, boolean | null>;
    errors?: string[];
    last_registration_error?: string | null;
    registered_at?: string | null;
    subscribed_apps_at?: string | null;
  };
  const [registrationProbe, setRegistrationProbe] =
    useState<RegistrationProbe | null>(null);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  const fetchConfig = useCallback(async (acctId: string, preferredConfigId?: string | null) => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', acctId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to load WhatsApp config rows:', error);
      }

      const available = (rows ?? []) as WhatsAppConfigType[];
      setConfigs(available);

      const selected =
        available.find((row) => row.id === (preferredConfigId ?? selectedConfigId)) ?? null;

      if (!selected) {
        setSelectedConfigId(null);
        setConfig(null);
        setPhoneNumberId('');
        setWabaId('');
        setAccessToken('');
        setVerifyToken('');
        setPin('');
        setTokenEdited(false);
        setVerifyEdited(false);
        setMirrorMedia(true);
        setRegistrationProbe(null);
        setConnectionStatus('disconnected');
        setResetReason(null);
        setStatusMessage('');
        setStatusMeta(null);
        setWabaSubscription(null);
        return;
      }

      setSelectedConfigId(selected.id);
      setConfig(selected);
      setPhoneNumberId(selected.phone_number_id || '');
      setWabaId(selected.waba_id || '');
      setAccessToken(MASKED_TOKEN);
      setVerifyToken(selected.verify_token ? MASKED_TOKEN : '');
      setVerifyEdited(false);
      setPin('');
      setTokenEdited(false);
      setMirrorMedia(selected.mirror_inbound_media !== false);
      setRegistrationProbe(null);

      try {
        nameLookupIdsRef.current.add(selected.id);
        const query = new URLSearchParams({ config_id: selected.id });
        const res = await fetch(`/api/whatsapp/config?${query.toString()}`, { method: 'GET' });
        const payload = await res.json();
        const verifiedName = payload.phone_info?.verified_name?.trim();
        if (verifiedName) {
          setConnectionNames((previous) => ({ ...previous, [selected.id]: verifiedName }));
        }

        if (payload.connected) {
          setConnectionStatus('connected');
          setResetReason(null);
          setStatusMessage('');
          setStatusMeta(null);
          setWabaSubscription(payload.waba_subscription ?? null);
        } else {
          setConnectionStatus('disconnected');
          setResetReason(
            payload.needs_reset
              ? 'token_corrupted'
              : payload.reason === 'meta_api_error'
                ? 'meta_api_error'
                : null,
          );
          setStatusMessage(payload.message || '');
          setStatusMeta(payload.meta ?? null);
          setWabaSubscription(null);
        }
      } catch (err) {
        console.error('Health check failed:', err);
        setConnectionStatus('disconnected');
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      toast.error(t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [supabase, t, selectedConfigId]);

  useEffect(() => {
    // Need both the auth session (`!authLoading`) AND the profile
    // (`!profileLoading`, which carries `accountId`). Without the
    // second guard, the effect would fire with `accountId === null`
    // for the first render window and bail without ever retrying
    // once the profile arrives.
    if (authLoading || profileLoading) return;
    if (!user || !accountId) {
      loadedAccountIdRef.current = null;
      setLoading(false);
      return;
    }
    if (loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    fetchConfig(accountId);
  }, [authLoading, profileLoading, user?.id, accountId, fetchConfig]);

  useEffect(() => {
    for (const item of configs) {
      if (nameLookupIdsRef.current.has(item.id)) continue;
      nameLookupIdsRef.current.add(item.id);
      const query = new URLSearchParams({ config_id: item.id });
      void fetch(`/api/whatsapp/config?${query.toString()}`)
        .then((response) => response.json())
        .then((payload) => {
          const verifiedName = payload.phone_info?.verified_name?.trim();
          if (verifiedName) {
            setConnectionNames((previous) => ({ ...previous, [item.id]: verifiedName }));
          }
        })
        .catch(() => nameLookupIdsRef.current.delete(item.id));
    }
  }, [configs]);

  async function handleToggleMirrorMedia(next: boolean) {
    if (!config || !accountId || savingMirror) return;
    // Optimistic — the switch should feel instant; a failure rolls it
    // back rather than leaving the UI ahead of the row.
    const previous = mirrorMedia;
    setMirrorMedia(next);
    setSavingMirror(true);
    try {
      const { error } = await supabase
        .from('whatsapp_config')
        .update({ mirror_inbound_media: next })
        .eq('id', config.id)
        .eq('account_id', accountId);
      if (error) throw new Error(error.message);
      setConfig({ ...config, mirror_inbound_media: next });
    } catch (error) {
      console.error('Failed to update media retention setting:', error);
      setMirrorMedia(previous);
      toast.error(t('mirrorInboundSaveFailed'));
    } finally {
      setSavingMirror(false);
    }
  }

  async function handleSave() {
    if (!phoneNumberId.trim()) {
      toast.error(t('phoneNumberIdRequired'));
      return;
    }
    if (!META_ID_RE.test(phoneNumberId.trim())) {
      toast.error(t('phoneNumberIdNotNumeric'));
      return;
    }
    if (wabaId.trim() && !META_ID_RE.test(wabaId.trim())) {
      toast.error(t('wabaIdNotNumeric'));
      return;
    }
    if (!config && (!accessToken.trim() || !tokenEdited)) {
      toast.error(t('accessTokenRequired'));
      return;
    }

    try {
      setSaving(true);

      // Always POST through the API — it verifies with Meta and encrypts
      // the access_token server-side with ENCRYPTION_KEY. Skipping this
      // and writing direct to Supabase stores the token in plaintext,
      // which then fails decryption on every subsequent health check.
      const payload: Record<string, unknown> = {
        ...(config?.id ? { config_id: config.id } : {}),
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || null,
        // Only sent when the user actually typed one. Left out otherwise
        // (undefined is dropped from the JSON body) so the server keeps the
        // stored token instead of nulling it — see resolveVerifyTokenForSave.
        ...(verifyEdited &&
        verifyToken.trim() &&
        verifyToken.trim() !== MASKED_TOKEN
          ? { verify_token: verifyToken.trim() }
          : {}),
        // Optional — only sent when the user filled it in. The server
        // requires it on first save or when changing numbers; for a
        // simple token rotation, leaving it blank skips re-register.
        pin: pin.trim() || null,
      };

      if (tokenEdited && accessToken !== MASKED_TOKEN && accessToken.trim()) {
        payload.access_token = accessToken.trim();
      } else if (config) {
        // Existing config — reuse stored encrypted token by decrypting on the
        // server. But our POST handler requires an access_token to verify
        // with Meta. If the user didn't change the token, we need to signal
        // that. Simplest: require token re-entry if they're updating.
        toast.error(t('reenterAccessToken'));
        setSaving(false);
        return;
      }

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // The route names the failing step and which field to check
        // (issue #505). Keep the details on screen — a toast is too
        // short-lived to copy a trace id out of.
        setSaveFailure({
          message: data.error || t('saveFailed'),
          meta: data.meta ?? null,
        });
        toast.error(data.error || t('saveFailed'), { duration: 10000 });
        setSaving(false);
        return;
      }
      setSaveFailure(null);
      setIsAddingConnection(false);

      // The route now returns a structured outcome:
      //   * registered=true   → number is live, events will flow
      //   * registered=false  → credentials saved but /register
      //                         failed; UI shows the specific error
      //                         and a retry path. registration_error
      //                         is human-readable from Meta.
      if (data.registered === false && data.registration_error) {
        setSaveFailure({
          message: `Saved, but Meta couldn't register the number: ${data.registration_error}`,
          meta: data.meta ?? null,
        });
        toast.error(
          t('savedButRegistrationFailed', { error: data.registration_error }),
          { duration: 12000 },
        );
      } else if (data.registration_skipped) {
        // Credentials saved + verified, but /register was skipped
        // because no PIN was supplied (e.g. a Meta test number).
        // Don't claim the number is "Live" — point at the
        // Registration status banner instead.
        toast.success(
          t('savedRegistrationSkipped'),
          { duration: 10000 },
        );
        setPin('');
      } else {
        toast.success(
          data.phone_info?.verified_name
            ? t('liveWithName', { name: data.phone_info.verified_name })
            : t('connectedGeneric'),
        );
        // Clear the PIN so subsequent saves don't accidentally
        // re-register (which would void the active subscription if
        // the PIN became stale).
        setPin('');
      }

      if (accountId) await fetchConfig(accountId, data.config_id ?? config?.id ?? null);
    } catch (err) {
      console.error('Save error:', err);
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);
      const query = config?.id ? `?config_id=${encodeURIComponent(config.id)}` : '';
      const res = await fetch(`/api/whatsapp/config${query}`, { method: 'GET' });
      const payload = await res.json();

      if (payload.connected) {
        setConnectionStatus('connected');
        setResetReason(null);
        setStatusMessage('');
        setStatusMeta(null);
        setWabaSubscription(payload.waba_subscription ?? null);
        toast.success(
          payload.phone_info?.verified_name
            ? t('connectedTo', { name: payload.phone_info.verified_name })
            : t('apiConnectionOk')
        );
      } else {
        setConnectionStatus('disconnected');
        setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
        setStatusMessage(payload.message || '');
        setStatusMeta(payload.meta ?? null);
        setWabaSubscription(null);
        toast.error(payload.message || t('apiConnectionFailed'), { duration: 10000 });
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setConnectionStatus('disconnected');
      toast.error(t('connectionTestFailed'));
    } finally {
      setTesting(false);
    }
  }

  async function handleVerifyRegistration() {
    setVerifyingRegistration(true);
    setRegistrationProbe(null);
    try {
      const query = config?.id ? `?config_id=${encodeURIComponent(config.id)}` : '';
      const res = await fetch(`/api/whatsapp/config/verify-registration${query}`, {
        method: 'GET',
      });
      const data = (await res.json()) as RegistrationProbe;
      setRegistrationProbe(data);
      if (data.live) {
        toast.success(t('fullyWired'));
      } else {
        toast.error(
          t('notFullyRegistered'),
          { duration: 8000 },
        );
      }
      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      console.error('verify-registration failed:', err);
      toast.error(t('verifyEndpointUnreachable'));
    } finally {
      setVerifyingRegistration(false);
    }
  }

  async function handleReset() {
    if (!confirm(t('resetConfirm'))) {
      return;
    }

    try {
      setResetting(true);
      const query = config?.id ? `?config_id=${encodeURIComponent(config.id)}` : '';
      const res = await fetch(`/api/whatsapp/config${query}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t('resetFailed'));
        return;
      }

      toast.success(t('resetDone'));
      if (accountId) {
        await fetchConfig(accountId, null);
      } else {
        setConfigs([]);
        setSelectedConfigId(null);
        setConfig(null);
        setPhoneNumberId('');
        setWabaId('');
      }
      setAccessToken('');
      setVerifyToken('');
      setTokenEdited(false);
      setVerifyEdited(false);
      setConnectionStatus('disconnected');
      setResetReason(null);
      setStatusMessage('');
      setStatusMeta(null);
      setSaveFailure(null);
      setWabaSubscription(null);
    } catch (err) {
      console.error('Reset error:', err);
      toast.error(t('resetFailed'));
    } finally {
      setResetting(false);
    }
  }

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success(t('webhookCopied'));
  }

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title={t("title")}
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  const showResetBanner = resetReason === 'token_corrupted';

  // Step + code + trace id in small muted text, so a user can quote
  // them to Meta support (issue #505). The step names are wire values
  // from the route, shown verbatim.
  const renderMetaDetails = (meta: MetaErrorMeta) => (
    <div className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-muted-foreground break-all">
      <p>
        {t('metaErrorStep')}: <code>{meta.step}</code>
        {meta.code !== null && meta.code !== undefined && (
          <>
            {' · '}
            {t('metaErrorCode')}:{' '}
            <code>
              {meta.code}
              {meta.subcode !== null && meta.subcode !== undefined ? `/${meta.subcode}` : ''}
            </code>
          </>
        )}
        {meta.fbtrace_id && (
          <>
            {' · '}
            {t('metaErrorTrace')}: <code>{meta.fbtrace_id}</code>
          </>
        )}
      </p>
      {meta.message && (
        <p>
          {t('metaErrorMessage')}: {meta.message}
        </p>
      )}
      <p>{t('metaErrorDetailsHint')}</p>
    </div>
  );

  const connectionStatusContent = (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">Connection status</h3>
      <Alert className="bg-card border-border">
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <CheckCircle2 className="size-4 text-primary" />
          ) : (
            <XCircle className="size-4 text-red-500" />
          )}
          <AlertTitle className="text-foreground mb-0">
            {connectionStatus === 'connected' ? t('credentialsValid') : t('notConnected')}
          </AlertTitle>
        </div>
        <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
          {connectionStatus === 'connected'
            ? t('connectedDesc')
            : statusMessage || t('notConnectedDesc')}
        </AlertDescription>
        {connectionStatus === 'connected' && wabaSubscription?.checked && (
          <p
            className={
              'mt-1 text-xs leading-relaxed ' +
              (wabaSubscription.subscribed === false
                ? 'text-amber-300'
                : 'text-muted-foreground')
            }
          >
            {wabaSubscription.subscribed === false
              ? t('wabaNotSubscribed')
              : wabaSubscription.subscribed === true
                ? t('wabaSubscribed')
                : wabaSubscription.error}
          </p>
        )}
        {connectionStatus !== 'connected' && statusMeta && renderMetaDetails(statusMeta)}
      </Alert>

      {config && (
        <Alert
          className={
            isRegistered
              ? 'bg-emerald-950/30 border-emerald-700/50'
              : 'bg-amber-950/30 border-amber-700/50'
          }
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {isRegistered ? (
                <CheckCircle2 className="size-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="size-4 text-amber-400" />
              )}
              <AlertTitle
                className={'mb-0 ' + (isRegistered ? 'text-emerald-200' : 'text-amber-200')}
              >
                {isRegistered ? t('registered') : t('notRegistered')}
              </AlertTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifyRegistration}
              disabled={verifyingRegistration}
              className="border-border bg-transparent text-foreground hover:bg-muted h-7"
            >
              {verifyingRegistration ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Zap className="size-3.5" />
              )}
              {t('verifyWithMeta')}
            </Button>
          </div>
          <AlertDescription className="text-muted-foreground mt-2 text-xs leading-relaxed">
            {isRegistered ? (
              <span
                dangerouslySetInnerHTML={{
                  __html: t('subscribedSince', {
                    date: config.registered_at
                      ? new Date(config.registered_at).toLocaleString()
                      : t('unknownDate'),
                  }),
                }}
              />
            ) : lastRegistrationError ? (
              <>
                {t('lastAttemptFailed')}
                <span className="text-red-300">&quot;{lastRegistrationError}&quot;</span>.
                {' '}{t('retryHint')}
              </>
            ) : (
              t('noRegistrationHint')
            )}
          </AlertDescription>
          {registrationProbe && (
            <div className="mt-3 rounded border border-border bg-card/60 px-3 py-2 space-y-1.5 text-[11px]">
              <p className="font-medium text-foreground">
                {t('diagnosticLastRun')}
                <span className={registrationProbe.live ? 'text-emerald-400' : 'text-amber-400'}>
                  {registrationProbe.live ? t('live') : t('notLive')}
                </span>
              </p>
              <ul className="space-y-0.5 text-muted-foreground">
                {Object.entries(registrationProbe.checks).map(([key, value]) => (
                  <li key={key} className="flex items-center gap-1.5">
                    {value === true ? (
                      <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                    ) : value === false ? (
                      <XCircle className="size-3 text-red-400 shrink-0" />
                    ) : (
                      <span className="size-3 rounded-full border border-border shrink-0" />
                    )}
                    <code className="text-muted-foreground">{key}</code>
                  </li>
                ))}
              </ul>
              {(registrationProbe.errors ?? []).length > 0 && (
                <ul className="pt-1 space-y-0.5 text-red-300">
                  {registrationProbe.errors?.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Alert>
      )}
    </div>
  );

  const connectionActions = (
    <div className="flex flex-wrap gap-3 border-t border-border pt-4">
      <Button
        onClick={handleSave}
        disabled={saving}
        className="bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        {saving ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t('saving')}
          </>
        ) : (
          t('saveConfig')
        )}
      </Button>
      <Button
        variant="outline"
        onClick={handleTestConnection}
        disabled={testing || !config}
        className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        {testing ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t('testing')}
          </>
        ) : (
          <>
            <Zap className="size-4" />
            {t('testConnection')}
          </>
        )}
      </Button>
      {config && (
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={resetting}
          className="border-red-900 text-red-400 hover:text-red-300 hover:bg-red-950/40"
        >
          {resetting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('resetting')}
            </>
          ) : (
            <>
              <RotateCcw className="size-4" />
              {t('resetConfig')}
            </>
          )}
        </Button>
      )}
    </div>
  );

  const credentialsContent = (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-medium text-foreground">{t('apiCredentialsTitle')}</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-muted-foreground">{t('phoneNumberId')}</Label>
          <Input
            placeholder={t('phoneNumberIdPlaceholder')}
            value={phoneNumberId}
            onChange={(event) => setPhoneNumberId(event.target.value)}
            className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground placeholder:opacity-60"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">{t('wabaId')}</Label>
          <Input
            placeholder={t('wabaIdPlaceholder')}
            value={wabaId}
            onChange={(event) => setWabaId(event.target.value)}
            className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground placeholder:opacity-60"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground">{t('accessToken')}</Label>
        <div className="relative">
          <Input
            type={showToken ? 'text' : 'password'}
            placeholder={t('accessTokenPlaceholder')}
            value={accessToken}
            onChange={(event) => {
              setAccessToken(event.target.value);
              setTokenEdited(true);
            }}
            onFocus={() => {
              if (accessToken === MASKED_TOKEN) {
                setAccessToken('');
                setTokenEdited(true);
              }
            }}
            className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground placeholder:opacity-60 pr-10"
          />
          <button
            type="button"
            aria-label={t('accessToken')}
            onClick={() => setShowToken(!showToken)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-muted-foreground">{t('webhookVerifyToken')}</Label>
          <Input
            placeholder={t('webhookVerifyTokenPlaceholder')}
            value={verifyToken}
            onChange={(event) => {
              setVerifyToken(event.target.value);
              setVerifyEdited(true);
            }}
            onFocus={() => {
              if (verifyToken === MASKED_TOKEN) {
                setVerifyToken('');
                setVerifyEdited(true);
              }
            }}
            className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground placeholder:opacity-60"
          />
        </div>
        <div className="space-y-3 border-t border-border pt-4 md:col-span-2">
          <div className="space-y-2">
            <Label className="text-muted-foreground">{t('webhookUrl')}</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={webhookUrl}
                className="bg-muted border-border text-xs text-muted-foreground font-mono placeholder:opacity-60"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyWebhookUrl}
                className="shrink-0 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">
            {t('twoStepPin')}
            <span className="ml-1 text-muted-foreground">{t('optional')}</span>
          </Label>
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder={t('pinPlaceholder')}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground placeholder:opacity-60 tracking-widest"
          />
        </div>
      </div>
      {connectionActions}
    </div>
  );

  return (
    <section className="animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title={t("title")}
      />

      <div className="grid gap-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                {configs.map((item) => {
                  const selected = item.id === selectedConfigId && !isAddingConnection;

                  return (
                    <div
                      key={item.id}
                      className={
                        'overflow-hidden rounded-xl border transition ' +
                        (selected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-muted/20')
                      }
                    >
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-expanded={selected && config?.id === item.id}
                        onClick={() => {
                          if (selected && config?.id === item.id) {
                            setSelectedConfigId(null);
                            setSaveFailure(null);
                            return;
                          }
                          setIsAddingConnection(false);
                          setSelectedConfigId(item.id);
                          setConfig(null);
                          if (accountId) void fetchConfig(accountId, item.id);
                        }}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 p-3 text-left transition hover:bg-muted/40"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            {connectionNames[item.id] || 'WhatsApp account'}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            WABA ID: {item.waba_id || 'Not set'}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            PHONE ID: {item.phone_number_id}
                          </div>
                        </div>
                        <span
                          className={
                            'rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wide ' +
                            (item.status === 'connected'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-muted text-muted-foreground')
                          }
                        >
                          {item.status === 'connected' ? 'Connected' : 'Disconnected'}
                        </span>
                      </button>
                      {selected && config?.id === item.id && (
                        <div className="space-y-6 border-t border-border p-4">
                          {connectionStatusContent}
                          {credentialsContent}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {canEditSettings && (
                <div className="flex justify-center pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingConnection(true);
                      setSelectedConfigId(null);
                      setConfig(null);
                      setPhoneNumberId('');
                      setWabaId('');
                      setAccessToken('');
                      setVerifyToken('');
                      setPin('');
                      setTokenEdited(false);
                      setVerifyEdited(false);
                      setMirrorMedia(true);
                      setConnectionStatus('disconnected');
                      setResetReason(null);
                      setStatusMessage('');
                      setStatusMeta(null);
                      setWabaSubscription(null);
                      setRegistrationProbe(null);
                      setSaveFailure(null);
                    }}
                  >
                    Add WhatsApp number
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {showResetBanner && (
              <Alert className="bg-amber-950/40 border-amber-600/40">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <AlertTitle className="text-amber-200 mb-1">
                      {t('tokenCorrupted')}
                    </AlertTitle>
                    <AlertDescription className="text-amber-100/80 text-sm">
                      {statusMessage}
                    </AlertDescription>
                    <Button
                      onClick={handleReset}
                      disabled={resetting}
                      size="sm"
                      className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {resetting ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          {t('resetting')}
                        </>
                      ) : (
                        <>
                          <RotateCcw className="size-4" />
                          {t('resetConfig')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Alert>
            )}

            {saveFailure && (
              <Alert className="bg-red-950/30 border-red-700/50">
                <div className="flex items-start gap-3">
                  <XCircle className="size-5 text-red-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <AlertTitle className="text-red-200 mb-1">{t('lastSaveFailed')}</AlertTitle>
                    <AlertDescription className="text-red-100/80 text-sm">
                      {saveFailure.message}
                    </AlertDescription>
                    {saveFailure.meta && renderMetaDetails(saveFailure.meta)}
                  </div>
                </div>
              </Alert>
            )}
          </div>

          {isAddingConnection && (
            <Card>
              <CardContent>{credentialsContent}</CardContent>
            </Card>
          )}

          {config && selectedConfigId === config.id && !isAddingConnection && (
            <Card>
              <CardContent>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t('mirrorInbound')}
                    </p>
                    {!mirrorMedia && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                        {t('mirrorInboundOffWarning')}
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={mirrorMedia}
                    onCheckedChange={handleToggleMirrorMedia}
                    disabled={savingMirror || !canEditSettings}
                    aria-label={t('mirrorInbound')}
                  />
                </div>
              </CardContent>
            </Card>
          )}

        </div>

      </div>
    </section>
  );
}
