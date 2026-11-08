CREATE TABLE IF NOT EXISTS public.portal_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_name text NOT NULL CHECK (length(btrim(couple_name)) > 0),
  wedding_date date NOT NULL,
  service text NOT NULL CHECK (service IN ('day_of_coordination', 'wedding_planning')),
  venue text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('contract', 'itinerary')),
  content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object'),
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, document_type)
);

CREATE TABLE IF NOT EXISTS public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('contract', 'itinerary')),
  bucket_id text NOT NULL DEFAULT 'portal-documents' CHECK (bucket_id = 'portal-documents'),
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (length(btrim(file_name)) > 0),
  content_type text NOT NULL DEFAULT 'application/pdf' CHECK (content_type = 'application/pdf'),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 15728640),
  uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, document_type),
  CHECK (storage_path LIKE client_id::text || '/%')
);

CREATE INDEX IF NOT EXISTS clients_wedding_date_idx
  ON public.clients (wedding_date);

CREATE OR REPLACE FUNCTION public.is_portal_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.portal_admins
    WHERE user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_portal_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_portal_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS clients_set_updated_at ON public.clients;
CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS document_drafts_set_updated_at ON public.document_drafts;
CREATE TRIGGER document_drafts_set_updated_at
  BEFORE UPDATE ON public.document_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.portal_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.portal_admins, public.clients, public.document_drafts, public.client_documents
  FROM anon, authenticated;

GRANT SELECT ON TABLE public.portal_admins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.client_documents TO authenticated;

DROP POLICY IF EXISTS "Portal admins can read their own membership" ON public.portal_admins;
CREATE POLICY "Portal admins can read their own membership"
  ON public.portal_admins
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Portal admins can manage clients" ON public.clients;
CREATE POLICY "Portal admins can manage clients"
  ON public.clients
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_portal_admin()))
  WITH CHECK ((SELECT public.is_portal_admin()));

DROP POLICY IF EXISTS "Portal admins can manage document drafts" ON public.document_drafts;
CREATE POLICY "Portal admins can manage document drafts"
  ON public.document_drafts
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_portal_admin()))
  WITH CHECK ((SELECT public.is_portal_admin()));

DROP POLICY IF EXISTS "Portal admins can manage client documents" ON public.client_documents;
CREATE POLICY "Portal admins can manage client documents"
  ON public.client_documents
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_portal_admin()))
  WITH CHECK ((SELECT public.is_portal_admin()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('portal-documents', 'portal-documents', false, 15728640, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 15728640,
    allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS "Portal admins can manage private portal PDFs" ON storage.objects;
CREATE POLICY "Portal admins can manage private portal PDFs"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'portal-documents'
    AND (SELECT public.is_portal_admin())
  )
  WITH CHECK (
    bucket_id = 'portal-documents'
    AND (SELECT public.is_portal_admin())
  );
