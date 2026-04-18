ALTER TABLE public.findings ADD COLUMN ai_severity_raw TEXT;
COMMENT ON COLUMN public.findings.ai_severity_raw IS 'Exact severity string returned by LLM before mapping. NULL for manual findings.';