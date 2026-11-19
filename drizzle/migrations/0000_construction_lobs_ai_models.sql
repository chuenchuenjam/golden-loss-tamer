ALTER TABLE public.lines_of_business ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT false;
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS is_baseline boolean NOT NULL DEFAULT false;

INSERT INTO public.lines_of_business (name, slug, active) VALUES
 ('Construction - Primary Casualty','construction-primary-casualty', true),
 ('Construction - Excess Casualty','construction-excess-casualty', true),
 ('Construction - Property','construction-property', true)
ON CONFLICT DO NOTHING;
UPDATE public.lines_of_business SET active = true WHERE slug IN ('construction-primary-casualty','construction-excess-casualty','construction-property');

INSERT INTO public.templates (name, lob_id, fields, is_system, label, is_golden)
SELECT 'Construction - Primary Casualty AI model', id,
 '[{"key":"claim_number","label":"Claim Number","required":true,"hint":"","value":""},{"key":"coverage_line","label":"Coverage (GL / AL / WC)","required":true,"hint":"","value":""},{"key":"policy_year","label":"Policy Year","required":false,"hint":"","value":""},{"key":"date_of_loss","label":"Date of Loss","required":true,"hint":"ISO date","value":""},{"key":"status","label":"Open / Closed","required":false,"hint":"","value":""},{"key":"description","label":"Description","required":false,"hint":"","value":""},{"key":"paid_indemnity","label":"Paid Indemnity","required":false,"hint":"number","value":""},{"key":"paid_expense","label":"Paid Expense","required":false,"hint":"number","value":""},{"key":"reserve_indemnity","label":"Reserve Indemnity","required":false,"hint":"number","value":""},{"key":"reserve_expense","label":"Reserve Expense","required":false,"hint":"number","value":""},{"key":"incurred_total","label":"Total Incurred","required":false,"hint":"number","value":""}]'::jsonb,
 true, 'System', false FROM public.lines_of_business WHERE slug='construction-primary-casualty'
 AND NOT EXISTS (SELECT 1 FROM public.templates WHERE name='Construction - Primary Casualty AI model');

INSERT INTO public.templates (name, lob_id, fields, is_system, label, is_golden)
SELECT 'Construction - Excess Casualty AI model', id,
 '[{"key":"record_type","label":"Record type (Policy Year / Large Loss)","required":true,"hint":"\"Policy Year\" for the per-year summary rows, \"Large Loss\" for individual large losses","value":""},{"key":"coverage_line","label":"Coverage (GL / AL / Other / Umbrella)","required":true,"hint":"General Liability=GL, Automobile Liability=AL, Other Liability=Other, Umbrella","value":""},{"key":"policy_year","label":"Policy Year","required":true,"hint":"","value":""},{"key":"num_claims","label":"# of Claims","required":false,"hint":"number","value":""},{"key":"valuation_date","label":"Valuation Date","required":false,"hint":"ISO date","value":""},{"key":"insurer","label":"Insurer","required":false,"hint":"","value":""},{"key":"tpa","label":"TPA","required":false,"hint":"","value":""},{"key":"accident_date","label":"Acc Date (large loss)","required":false,"hint":"ISO date","value":""},{"key":"status","label":"Open or Closed (large loss)","required":false,"hint":"","value":""},{"key":"description","label":"Description","required":false,"hint":"","value":""},{"key":"incurred_indemnity","label":"Incurred Indemnity","required":false,"hint":"number","value":""},{"key":"incurred_expense","label":"Incurred Expense","required":false,"hint":"number","value":""},{"key":"paid_indemnity","label":"Paid Indemnity","required":false,"hint":"number","value":""},{"key":"paid_expense","label":"Paid Expense","required":false,"hint":"number","value":""},{"key":"total_incurred","label":"Total Incurred","required":false,"hint":"number as stated on loss run","value":""},{"key":"total_paid","label":"Total Paid","required":false,"hint":"number as stated","value":""},{"key":"total_reserve","label":"Total Reserve","required":false,"hint":"number as stated","value":""},{"key":"prev_valuation_date","label":"Previous Valuation Date","required":false,"hint":"ISO date, leave blank if none","value":""},{"key":"prev_total_incurred","label":"Previous Total Incurred","required":false,"hint":"number, leave blank if not supplied","value":""},{"key":"prev_total_paid","label":"Previous Total Paid","required":false,"hint":"number","value":""}]'::jsonb,
 true, 'System', false FROM public.lines_of_business WHERE slug='construction-excess-casualty'
 AND NOT EXISTS (SELECT 1 FROM public.templates WHERE name='Construction - Excess Casualty AI model');

INSERT INTO public.templates (name, lob_id, fields, is_system, label, is_golden)
SELECT 'Construction - Property AI model', id,
 '[{"key":"claim_number","label":"Claim Number","required":true,"hint":"","value":""},{"key":"location","label":"Location / Site","required":false,"hint":"","value":""},{"key":"date_of_loss","label":"Date of Loss","required":true,"hint":"ISO date","value":""},{"key":"cause_of_loss","label":"Cause of Loss","required":false,"hint":"","value":""},{"key":"status","label":"Open / Closed","required":false,"hint":"","value":""},{"key":"paid_indemnity","label":"Paid","required":false,"hint":"number","value":""},{"key":"reserve_indemnity","label":"Reserve","required":false,"hint":"number","value":""},{"key":"incurred_total","label":"Total Incurred","required":false,"hint":"number","value":""}]'::jsonb,
 true, 'System', false FROM public.lines_of_business WHERE slug='construction-property'
 AND NOT EXISTS (SELECT 1 FROM public.templates WHERE name='Construction - Property AI model');

INSERT INTO public.templates (name, lob_id, fields, is_system, label, is_golden, is_baseline)
SELECT 'Middle Market baseline AI model', l.id, t.fields, true, 'System', false, true
FROM public.lines_of_business l, public.templates t
WHERE l.slug='construction-primary-casualty' AND t.name='Generic General Liability Loss Run'
 AND NOT EXISTS (SELECT 1 FROM public.templates WHERE name='Middle Market baseline AI model');