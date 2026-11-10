-- Stores portal-wide settings, such as the payment and contact details
-- printed on new contracts. A single row (id = 1) holds all settings.
-- Safe to run more than once. Only allowlisted portal admins can read or change it.

CREATE TABLE IF NOT EXISTS public.portal_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  contract jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(contract) = 'object'),
  updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS portal_settings_set_updated_at ON public.portal_settings;
CREATE TRIGGER portal_settings_set_updated_at
  BEFORE UPDATE ON public.portal_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.portal_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.portal_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.portal_settings TO authenticated;

DROP POLICY IF EXISTS "Portal admins can manage portal settings" ON public.portal_settings;
CREATE POLICY "Portal admins can manage portal settings"
  ON public.portal_settings
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_portal_admin()))
  WITH CHECK ((SELECT public.is_portal_admin()));
