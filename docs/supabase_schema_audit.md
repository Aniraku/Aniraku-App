# Aniraku Supabase Schema Audit

**Project:** Aniraku (`sbjdrjaovcgvttfnpfsz`)

**Audit date:** 2026-08-13

## Executive assessment

The Aniraku SQL schema is structurally suitable for the current product. It has user-owned profiles, watch history, bookmarks, comments, ratings, notifications, settings, favorites, role data, and composite keys for synchronization tables. Row Level Security is enabled on all inspected public tables.

The schema was not fully production-hardened before this audit. Supabase security advisors identified a mutable `search_path` on `public.check_username_available(text)`, and performance advisors identified two foreign-key columns without indexes. Those issues were fixed in migration `20260813_safe_performance_and_rpc_hardening`.

## Live table coverage

| Area | Tables | Assessment |
|---|---|---|
| Identity and profile | `public.users`, `public.profiles`, `public.user_roles` | Good separation between auth identity, profile data, and roles. Both `users.id` and `profiles.id` reference `auth.users.id`. |
| Watching and progress | `public.watch_history`, `public.anime_progress`, `public.manga_progress` | Composite progress keys are appropriate. Watch-history data is user-scoped and episode/progress constraints are present. |
| Social | `public.comments`, `public.comment_likes`, `public.notifications` | Comment parent and like foreign keys are present; comment length and like score constraints exist. |
| Personalization | `public.bookmarks`, `public.favorites`, `public.user_settings` | User-scoped data and composite keys are present. |
| Groups and imports | `public.groups`, `public.group_members`, `public.import_jobs` | RLS and foreign keys exist; these areas are currently lightly populated and should be rechecked as usage grows. |
| Ratings | `public.episode_ratings` | Composite key `(user_id, anime_id, episode_number)` and score bounds 1–10 are correct for per-episode ratings. |

## Applied hardening migration

The following changes were applied safely through Supabase’s migration system:

```sql
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id
  ON public.comment_likes (user_id);

CREATE INDEX IF NOT EXISTS idx_group_members_user_id
  ON public.group_members (user_id);

CREATE OR REPLACE FUNCTION public.check_username_available(username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE LOWER(public.profiles.username) = LOWER(username)
  );
END;
$function$;
```

The two indexes cover the foreign keys flagged by Supabase performance advisors. The function search path now resolves explicitly and cannot be influenced by a caller-controlled search path.

## Remaining findings

Supabase still reports the following items for deliberate review:

| Finding | Status | Recommended treatment |
|---|---|---|
| `check_username_available` is callable by anonymous and authenticated roles | Intentional for pre-signup username availability checks, but it exposes whether a username exists | Keep only if the signup UI requires it; add client-side throttling/CAPTCHA and consider moving it to a non-public schema or authenticated-only flow if abuse appears. |
| `admin_stats`, `is_admin`, `delete_my_account`, and `toggle_comment_like` are `SECURITY DEFINER` RPCs callable by authenticated users | The inspected definitions validate `auth.uid()` or admin role where appropriate, and use an explicit `search_path` | Keep the security-definer design where it is required for controlled operations, but retain regression tests for admin authorization, self-account deletion, and like ownership. |
| Leaked-password protection is disabled | Not a SQL problem; it is a Supabase Auth project setting | Enable the Supabase Auth leaked-password protection setting in the Dashboard. |
| RLS policies call `auth.uid()` directly per row | Performance advisor warning; not a correctness or data-leak finding | At larger scale, rewrite policy expressions as `(select auth.uid())` in a dedicated migration, after testing each table’s behavior. |
| Several indexes are currently unused | Informational only; current row counts are small | Do not drop them yet. Re-evaluate after real traffic and query statistics accumulate. |

## RLS assessment

The inspected tables all have RLS enabled. Public read policies are intentionally present for profiles, comments, comment likes, groups, and group members. User-owned policies compare `auth.uid()` to the owning user ID. Some policies are declared for the `public` role but still require `auth.uid() = user_id`; anonymous requests therefore do not satisfy them. For clarity, these can be narrowed to the `authenticated` role later, but doing so is not required to correct the current access predicate and could affect signup/profile timing if changed without end-to-end testing.

## Email-template limitation

The available Supabase database connector can inspect and migrate the database, but it does not expose the hosted Auth email-template configuration. Ready-to-paste Aniraku-branded templates are provided in `docs/supabase_email_templates.md`. Apply them in **Supabase Dashboard → Authentication → Email Templates**, then test confirmation, recovery, magic link, invite, email change, reauthentication, and security notifications.

## References

[1]: https://supabase.com/docs/guides/database/database-linter "Supabase database advisor and linter documentation"
[2]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Row Level Security documentation"
[3]: https://supabase.com/docs/guides/auth/auth-email-templates "Supabase Auth email template documentation"
[4]: https://supabase.com/docs/guides/auth/password-security "Supabase password security and leaked-password protection"
