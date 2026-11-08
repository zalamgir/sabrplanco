CREATE TABLE IF NOT EXISTS public.email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('contract', 'itinerary')),
  recipient_emails text[] NOT NULL CHECK (cardinality(recipient_emails) BETWEEN 1 AND 5),
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 1 AND 200),
  resend_message_id text NOT NULL CHECK (length(btrim(resend_message_id)) > 0),
  sent_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id),
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_deliveries_client_sent_at_idx
  ON public.email_deliveries (client_id, sent_at DESC);

ALTER TABLE public.email_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.email_deliveries FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.email_deliveries TO authenticated;

DROP POLICY IF EXISTS "Portal admins can read email delivery history" ON public.email_deliveries;
CREATE POLICY "Portal admins can read email delivery history"
  ON public.email_deliveries
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_portal_admin()));

DROP POLICY IF EXISTS "Portal admins can record email deliveries" ON public.email_deliveries;
CREATE POLICY "Portal admins can record email deliveries"
  ON public.email_deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_portal_admin())
    AND sent_by = (SELECT auth.uid())
  );
