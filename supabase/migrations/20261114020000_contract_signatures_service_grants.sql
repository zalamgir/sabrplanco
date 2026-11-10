-- The contract-signing Edge Function writes signature requests and email history
-- with the service role. Some Supabase projects don't grant new tables to the
-- service role automatically, so grant exactly what the function needs.
-- Safe to run more than once.

GRANT SELECT, INSERT, UPDATE ON TABLE public.contract_signature_requests TO service_role;
GRANT INSERT ON TABLE public.email_deliveries TO service_role;
