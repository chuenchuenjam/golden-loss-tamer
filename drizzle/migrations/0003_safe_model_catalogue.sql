CREATE VIEW public.model_catalogue WITH (security_barrier=true) AS SELECT t.id,t.name,t.lob_id,t.is_baseline,t.is_system,t.label,t.source_kind,l.name AS lob_name,l.slug AS lob_slug,l.active AS lob_active FROM public.templates t LEFT JOIN public.lines_of_business l ON l.id=t.lob_id WHERE auth.uid() IS NOT NULL AND (t.is_baseline OR l.active);
REVOKE ALL ON public.model_catalogue FROM anon;
GRANT SELECT ON public.model_catalogue TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.protect_system_model() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
IF auth.uid() IS NOT NULL AND (OLD.is_system OR OLD.label='System') THEN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'System AI models are read-only. Copy as custom first.'; END IF;
 IF NEW.name IS DISTINCT FROM OLD.name OR NEW.fields IS DISTINCT FROM OLD.fields OR NEW.is_system IS DISTINCT FROM OLD.is_system OR NEW.label IS DISTINCT FROM OLD.label OR NEW.lob_id IS DISTINCT FROM OLD.lob_id OR NEW.source_file_path IS DISTINCT FROM OLD.source_file_path OR NEW.is_baseline IS DISTINCT FROM OLD.is_baseline THEN RAISE EXCEPTION 'System AI models are read-only. Copy as custom first.'; END IF;
END IF;
IF TG_OP='DELETE' THEN RETURN OLD; END IF;
RETURN NEW;
END; $$;
CREATE TRIGGER protect_system_model BEFORE UPDATE OR DELETE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.protect_system_model();