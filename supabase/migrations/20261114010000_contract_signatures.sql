-- Electronic contract signing.
-- Each row is one "send for signature" request: the exact PDF that was sent, a hashed
-- private link token, and the signing audit trail. The public signing page never reads
-- this table directly; it goes through the contract-signing Edge Function, which checks
-- the token. Only allowlisted portal admins can read requests from the portal.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.contract_signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'viewed', 'signed', 'voided')),
  recipient_emails text[] NOT NULL CHECK (cardinality(recipient_emails) BETWEEN 1 AND 5),
  client_name text NOT NULL CHECK (length(btrim(client_name)) BETWEEN 1 AND 200),
  unsigned_path text NOT NULL CHECK (unsigned_path LIKE client_id::text || '/%'),
  unsigned_sha256 text NOT NULL CHECK (unsigned_sha256 ~ '^[0-9a-f]{64}$'),
  signed_path text CHECK (signed_path IS NULL OR signed_path LIKE client_id::text || '/%'),
  signed_sha256 text CHECK (signed_sha256 IS NULL OR signed_sha256 ~ '^[0-9a-f]{64}$'),
  signer_name text CHECK (signer_name IS NULL OR length(btrim(signer_name)) BETWEEN 1 AND 200),
  signature_method text CHECK (signature_method IS NULL OR signature_method IN ('typed', 'drawn')),
  signer_ip text,
  signer_user_agent text,
  expires_at timestamptz NOT NULL,
  viewed_at timestamptz,
  signed_at timestamptz,
  voided_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'signed' OR (signed_at IS NOT NULL AND signed_path IS NOT NULL AND signer_name IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS contract_signature_requests_client_created_idx
  ON public.contract_signature_requests (client_id, created_at DESC);

ALTER TABLE public.contract_signature_requests ENABLE ROW LEVEL SECURITY;

-- Requests are created, updated, and signed only by the Edge Function (service role).
-- Portal admins can read them to show status and download signed copies.
REVOKE ALL ON TABLE public.contract_signature_requests FROM anon, authenticated;
GRANT SELECT ON TABLE public.contract_signature_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.contract_signature_requests TO service_role;
GRANT INSERT ON TABLE public.email_deliveries TO service_role;

DROP POLICY IF EXISTS "Portal admins can read signature requests" ON public.contract_signature_requests;
CREATE POLICY "Portal admins can read signature requests"
  ON public.contract_signature_requests
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_portal_admin()));
