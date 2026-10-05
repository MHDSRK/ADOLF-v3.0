# Adolf-V3.0

> Personal, account-scoped WhatsApp CRM built for focused customer operations.

Adolf-V3.0 combines a shared WhatsApp inbox, contacts, sales pipelines, broadcasts, automations, AI-assisted replies, team accounts and Meta WhatsApp Business integration in one application.

## Product focus

- **Shared WhatsApp inbox** — multiple agents, assignment, unread state, notes and conversation status.
- **Multiple WhatsApp numbers** — keep conversations and outbound sends tied to the correct business number.
- **Contacts** — tags, custom fields, CSV import and deduplication.
- **Sales pipelines** — manage deals and pipeline value without leaving the CRM.
- **Broadcasts** — Meta-approved WhatsApp templates with delivery/read tracking.
- **Automations and Flows** — trigger actions from inbound messages, contacts, keywords and schedules.
- **AI assistance** — optional BYO OpenAI/Anthropic configuration for drafts, auto-replies and knowledge-assisted responses.
- **Team accounts** — owner/admin/agent/viewer roles with account-scoped access.
- **Public API** — scoped API keys for integrations.
- **Supabase-backed security** — RLS, encrypted provider credentials and verified WhatsApp webhooks.

## Stack

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS
- Supabase Postgres, Auth, Storage and Realtime
- Meta WhatsApp Cloud API

## Development

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Useful checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Environment

Configure the Supabase publishable/secret keys, encryption key, Meta WhatsApp
credentials and required scheduler secret described in `.env.local.example`.

Supabase's new `sb_publishable_...` and `sb_secret_...` keys are the supported
configuration. The old `anon` / `service_role` environment variable names are
kept only as a temporary migration fallback.

Never commit secrets, access tokens, webhook verification tokens or Supabase
secret credentials.

## Scheduled workers

The production app exposes one authenticated scheduler endpoint:

`GET /api/cron`

It runs automation waits and Flow timeout sweeps under one database lock.
The individual endpoints remain available for diagnostics:

- `/api/automations/cron`
- `/api/flows/cron`

Vercel Hobby cannot schedule jobs more frequently than once per day, so this
repository intentionally does **not** configure Vercel Cron. GitHub Actions
invokes `/api/cron` every five minutes instead.

Configure these GitHub repository secrets:

- `ADOLF_CRON_BASE_URL` — the production origin, for example
  `https://crm.example.com`
- `CRON_SECRET` — the same random value configured in the deployment

Scheduled GitHub workflows run only from the repository's default branch, so
the scheduler becomes active after the workflow is merged to that branch.

## Repository

This project is maintained in:

https://github.com/MHDSRK/ADOLF-v3.0

The `main` branch is the current product branch. Production deployment configuration should be managed separately from source code secrets.

## License

MIT
