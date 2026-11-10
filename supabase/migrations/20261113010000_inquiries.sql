-- Website inquiries, saved alongside the Web3Forms email so they appear in the portal.
-- The public website may only INSERT new inquiries (and only the visitor-supplied
-- columns). Reading, updating, and deleting are limited to allowlisted portal admins.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 320 AND email LIKE '%_@_%'),
  service text CHECK (service IS NULL OR length(service) <= 100),
  wedding_date date,
  venue text CHECK (venue IS NULL OR length(venue) <= 250),
  message text CHECK (message IS NULL OR length(message) <= 5000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'converted', 'archived')),
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inquiries_status_created_at_idx
  ON public.inquiries (status, created_at DESC);

DROP TRIGGER IF EXISTS inquiries_set_updated_at ON public.inquiries;
CREATE TRIGGER inquiries_set_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.inquiries FROM anon, authenticated;
-- Website visitors can only supply these columns; status, client_id, and timestamps use defaults.
GRANT INSERT (name, email, service, wedding_date, venue, message) ON TABLE public.inquiries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inquiries TO authenticated;

DROP POLICY IF EXISTS "Website visitors can submit inquiries" ON public.inquiries;
CREATE POLICY "Website visitors can submit inquiries"
  ON public.inquiries
  FOR INSERT
  TO anon
  WITH CHECK (status = 'new' AND client_id IS NULL);

DROP POLICY IF EXISTS "Portal admins can manage inquiries" ON public.inquiries;
CREATE POLICY "Portal admins can manage inquiries"
  ON public.inquiries
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_portal_admin()))
  WITH CHECK ((SELECT public.is_portal_admin()));
