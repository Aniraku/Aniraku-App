-- Fix PostgreSQL's ambiguous reference between the function parameter and profiles.username.
-- The positional parameter keeps the existing RPC signature and preserves anon access.
CREATE OR REPLACE FUNCTION public.check_username_available(username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(public.profiles.username) = lower($1)
  );
END;
$$;

COMMENT ON FUNCTION public.check_username_available(text)
IS 'Returns true when a username is not already used, with an unambiguous parameter reference.';

GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
