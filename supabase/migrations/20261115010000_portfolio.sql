-- Portfolio: couples featured on the public website, managed from the portal.
-- The public site can read only published entries; only portal admins can create,
-- edit, publish, or delete them. Photos live in a public bucket (the website must be
-- able to show them) that only portal admins can upload to or delete from.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.portfolio_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_names text NOT NULL CHECK (length(btrim(couple_names)) BETWEEN 1 AND 120),
  wedding_date date,
  venue text CHECK (venue IS NULL OR length(venue) <= 200),
  service text CHECK (service IS NULL OR service IN ('day_of_coordination', 'wedding_planning')),
  review text CHECK (review IS NULL OR length(review) <= 3000),
  photographer_name text CHECK (photographer_name IS NULL OR length(photographer_name) <= 120),
  photographer_url text CHECK (photographer_url IS NULL OR (length(photographer_url) <= 300 AND photographer_url ~ '^https?://')),
  photos jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(photos) = 'array' AND jsonb_array_length(photos) <= 40),
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_entries_published_order_idx
  ON public.portfolio_entries (published, sort_order, wedding_date DESC);

DROP TRIGGER IF EXISTS portfolio_entries_set_updated_at ON public.portfolio_entries;
CREATE TRIGGER portfolio_entries_set_updated_at
  BEFORE UPDATE ON public.portfolio_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.portfolio_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.portfolio_entries FROM anon, authenticated;
-- Visitors can read only the public columns (not the linked client).
GRANT SELECT (id, couple_names, wedding_date, venue, service, review, photographer_name, photographer_url, photos, published, sort_order)
  ON TABLE public.portfolio_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portfolio_entries TO authenticated;

DROP POLICY IF EXISTS "Anyone can read published portfolio entries" ON public.portfolio_entries;
CREATE POLICY "Anyone can read published portfolio entries"
  ON public.portfolio_entries
  FOR SELECT
  TO anon
  USING (published);

DROP POLICY IF EXISTS "Portal admins can manage portfolio entries" ON public.portfolio_entries;
CREATE POLICY "Portal admins can manage portfolio entries"
  ON public.portfolio_entries
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_portal_admin()))
  WITH CHECK ((SELECT public.is_portal_admin()));

-- Public photo bucket: files are readable by URL; writes are admin-only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('portfolio-photos', 'portfolio-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "Portal admins can upload portfolio photos" ON storage.objects;
CREATE POLICY "Portal admins can upload portfolio photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'portfolio-photos' AND (SELECT public.is_portal_admin()));

DROP POLICY IF EXISTS "Portal admins can update portfolio photos" ON storage.objects;
CREATE POLICY "Portal admins can update portfolio photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'portfolio-photos' AND (SELECT public.is_portal_admin()))
  WITH CHECK (bucket_id = 'portfolio-photos' AND (SELECT public.is_portal_admin()));

DROP POLICY IF EXISTS "Portal admins can delete portfolio photos" ON storage.objects;
CREATE POLICY "Portal admins can delete portfolio photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'portfolio-photos' AND (SELECT public.is_portal_admin()));

DROP POLICY IF EXISTS "Portal admins can list portfolio photos" ON storage.objects;
CREATE POLICY "Portal admins can list portfolio photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'portfolio-photos' AND (SELECT public.is_portal_admin()));
