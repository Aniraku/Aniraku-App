-- Safe performance and RPC hardening applied to the Aniraku Supabase project.
-- Adds missing foreign-key indexes and fixes the SECURITY DEFINER search path.

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

GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon, authenticated;
