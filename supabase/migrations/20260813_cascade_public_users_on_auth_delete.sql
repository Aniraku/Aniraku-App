-- The legacy public.users mirror was the only auth.users foreign key without
-- ON DELETE CASCADE, blocking delete_my_account for accounts with a mirror row.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
