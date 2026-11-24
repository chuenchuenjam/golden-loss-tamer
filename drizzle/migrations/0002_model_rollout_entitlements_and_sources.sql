ALTER TABLE public.user_template_access ADD COLUMN enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.templates ADD COLUMN source_kind text NOT NULL DEFAULT 'Standard' CHECK (source_kind IN ('Standard','Golden Source','Edge Case'));
ALTER TABLE public.templates ADD COLUMN golden_template_id uuid REFERENCES public.templates(id);
CREATE OR REPLACE FUNCTION public.can_use_model(_user_id uuid, _template_id uuid, _lob_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT EXISTS (SELECT 1 FROM public.templates t LEFT JOIN public.lines_of_business l ON l.id=t.lob_id
WHERE t.id=_template_id AND (public.has_role(_user_id,'admin') OR
((t.is_baseline OR l.active) AND (t.is_baseline OR (t.lob_id=(SELECT p.lob_id FROM public.profiles p WHERE p.user_id=_user_id) AND (_lob_id IS NULL OR t.lob_id=_lob_id)))
AND COALESCE((SELECT a.enabled FROM public.user_template_access a WHERE a.user_id=_user_id AND a.template_id=t.id),t.is_baseline))));
$$;
REVOKE ALL ON FUNCTION public.can_use_model(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_use_model(uuid,uuid,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.enforce_job_model_access() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF auth.uid() IS NOT NULL AND NOT public.can_use_model(auth.uid(),NEW.template_id,NEW.lob_id) THEN RAISE EXCEPTION 'This AI model is not available for your account or line of business'; END IF;
RETURN NEW;
END; $$;
CREATE TRIGGER job_model_access BEFORE INSERT OR UPDATE OF template_id,lob_id ON public.extraction_jobs FOR EACH ROW EXECUTE FUNCTION public.enforce_job_model_access();
DROP POLICY "templates insert own" ON public.templates;
DROP POLICY "templates update own or admin" ON public.templates;
DROP POLICY "templates delete own or admin" ON public.templates;
CREATE POLICY "templates insert admin" ON public.templates FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "templates update admin" ON public.templates FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "templates delete admin" ON public.templates FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.validate_model_source() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
IF NEW.golden_template_id IS NOT NULL THEN
 IF NEW.source_kind <> 'Edge Case' OR NEW.golden_template_id=NEW.id OR NOT EXISTS (SELECT 1 FROM public.templates t WHERE t.id=NEW.golden_template_id AND t.source_kind='Golden Source' AND (t.lob_id=NEW.lob_id OR t.is_baseline)) THEN RAISE EXCEPTION 'Edge cases must reference a Golden Source model for the same line of business or Middle Market'; END IF;
END IF;
IF TG_OP='UPDATE' AND OLD.source_kind='Golden Source' AND (NEW.source_kind<>'Golden Source' OR NEW.lob_id IS DISTINCT FROM OLD.lob_id) AND EXISTS (SELECT 1 FROM public.templates t WHERE t.golden_template_id=OLD.id) THEN RAISE EXCEPTION 'Remove the linked edge cases before changing this Golden Source'; END IF;
RETURN NEW;
END; $$;
CREATE TRIGGER validate_model_source BEFORE INSERT OR UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.validate_model_source();