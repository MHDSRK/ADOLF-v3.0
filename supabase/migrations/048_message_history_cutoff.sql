-- Prevent WhatsApp history/backlog from being treated as live inbox messages.
-- The cutoff is advanced when a chat is cleared and starts at deployment time
-- for existing conversations. New conversations initialize it at creation time.
alter table public.conversations
  add column if not exists message_history_cutoff_at timestamptz;

update public.conversations
set message_history_cutoff_at = now()
where message_history_cutoff_at is null;

create index if not exists conversations_history_cutoff_idx
  on public.conversations (id, message_history_cutoff_at);
