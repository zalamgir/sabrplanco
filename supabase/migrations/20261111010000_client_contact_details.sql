-- Adds optional contact and planning details to client workspaces.
-- Safe to run more than once. Existing Row Level Security policies on
-- public.clients already restrict these columns to portal admins.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS guest_count integer,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_email_length,
  DROP CONSTRAINT IF EXISTS clients_phone_length,
  DROP CONSTRAINT IF EXISTS clients_guest_count_range,
  DROP CONSTRAINT IF EXISTS clients_notes_length;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_email_length CHECK (email IS NULL OR length(email) <= 320),
  ADD CONSTRAINT clients_phone_length CHECK (phone IS NULL OR length(phone) <= 40),
  ADD CONSTRAINT clients_guest_count_range CHECK (guest_count IS NULL OR guest_count BETWEEN 0 AND 10000),
  ADD CONSTRAINT clients_notes_length CHECK (notes IS NULL OR length(notes) <= 5000);
