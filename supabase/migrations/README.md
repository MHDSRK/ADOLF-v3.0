# Migration policy

This repository intentionally keeps the numbered migration chain immutable.

Do not edit, reorder, rename, or delete a migration that may already have
been applied to a shared/production database. Supabase records migration
versions in supabase_migrations.schema_migrations; changing an old file does
not change that remote history and can make db push unsafe.

The current chain is long because it contains the project's real production
history. That is preferable to destructive history rewriting after deployment.

## Safe workflow

1. Add one new timestamped migration for each schema change.
2. Run `supabase db reset` locally.
3. Run the migration upgrade CI check, which also tests upgrading a populated
   database from migration 042 through the current head.
4. Review `supabase migration list` against the target environment.
5. Run `supabase db push --dry-run`.
6. Apply migrations once, from a controlled deployment job/operator.

## Squashing

Squashing is appropriate only for a repository/database pair that has **not**
yet been shared or deployed, or when the entire remote migration history is
deliberately being rebuilt under a coordinated migration plan. Do not squash
the production chain merely to reduce the file count.