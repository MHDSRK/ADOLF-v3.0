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

Configure the Supabase, encryption and Meta WhatsApp credentials described in `.env.local.example`.

Never commit secrets, access tokens, webhook verification tokens or service-role credentials.

## Repository

This project is maintained in:

https://github.com/MHDSRK/ADOLF-v3.0

The `main` branch is the current product branch. Production deployment configuration should be managed separately from source code secrets.

## License

MIT
