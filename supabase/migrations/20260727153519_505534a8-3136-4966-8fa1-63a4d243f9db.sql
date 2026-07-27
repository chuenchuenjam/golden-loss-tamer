
-- Roles enum + user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read all authed" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles read own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "user_roles admin read all" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  -- Bootstrap: first user is admin, rest are members
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Lines of business
CREATE TABLE public.lines_of_business (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lines_of_business TO authenticated;
GRANT ALL ON public.lines_of_business TO service_role;
ALTER TABLE public.lines_of_business ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lob read authed" ON public.lines_of_business FOR SELECT TO authenticated USING (true);
CREATE POLICY "lob admin write" ON public.lines_of_business FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.lines_of_business (name, slug) VALUES
  ('General Liability','general-liability'),
  ('Property','property'),
  ('Workers Compensation','workers-comp'),
  ('Commercial Auto','auto'),
  ('Cyber','cyber'),
  ('Marine','marine'),
  ('Professional Liability','professional'),
  ('Umbrella / Excess','umbrella');

-- Clients (insureds)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients read own or admin" ON public.clients FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "clients insert own" ON public.clients FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "clients update own or admin" ON public.clients FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "clients delete own or admin" ON public.clients FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Templates
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lob_id UUID NOT NULL REFERENCES public.lines_of_business(id) ON DELETE RESTRICT,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_golden BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_golden_per_lob ON public.templates (lob_id) WHERE is_golden;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- User template access
CREATE TABLE public.user_template_access (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, template_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_template_access TO authenticated;
GRANT ALL ON public.user_template_access TO service_role;
ALTER TABLE public.user_template_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uta read own or admin" ON public.user_template_access FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "uta admin write" ON public.user_template_access FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Template policies: user sees system templates, own templates, or granted templates
CREATE POLICY "templates read accessible" ON public.templates FOR SELECT TO authenticated USING (
  is_system OR owner_user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.user_template_access uta WHERE uta.template_id = templates.id AND uta.user_id = auth.uid())
);
CREATE POLICY "templates insert own" ON public.templates FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "templates update own or admin" ON public.templates FOR UPDATE TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "templates delete own or admin" ON public.templates FOR DELETE TO authenticated USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Seed a generic starter template per LOB
INSERT INTO public.templates (name, lob_id, fields, is_system, is_golden)
SELECT
  'Generic ' || lob.name || ' Loss Run',
  lob.id,
  '[
    {"key":"claim_number","label":"Claim Number","type":"string","required":true,"hint":"Unique claim identifier"},
    {"key":"policy_number","label":"Policy Number","type":"string","required":false,"hint":""},
    {"key":"date_of_loss","label":"Date of Loss","type":"date","required":true,"hint":"YYYY-MM-DD"},
    {"key":"date_reported","label":"Date Reported","type":"date","required":false,"hint":"YYYY-MM-DD"},
    {"key":"claimant","label":"Claimant","type":"string","required":false,"hint":""},
    {"key":"cause_of_loss","label":"Cause of Loss","type":"string","required":false,"hint":""},
    {"key":"description","label":"Description","type":"string","required":false,"hint":"Loss description"},
    {"key":"status","label":"Status","type":"string","required":false,"hint":"Open/Closed/Reopened"},
    {"key":"paid_indemnity","label":"Paid Indemnity","type":"number","required":false,"hint":"Amount in USD"},
    {"key":"paid_expense","label":"Paid Expense","type":"number","required":false,"hint":"Amount in USD"},
    {"key":"reserve_indemnity","label":"Reserve Indemnity","type":"number","required":false,"hint":"Amount in USD"},
    {"key":"reserve_expense","label":"Reserve Expense","type":"number","required":false,"hint":"Amount in USD"},
    {"key":"incurred_total","label":"Total Incurred","type":"number","required":false,"hint":"Paid + Reserve"},
    {"key":"deductible","label":"Deductible","type":"number","required":false,"hint":""},
    {"key":"currency","label":"Currency","type":"string","required":false,"hint":"ISO code, e.g. USD"}
  ]'::jsonb,
  true,
  true
FROM public.lines_of_business lob;

-- Extraction jobs
CREATE TABLE public.extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE RESTRICT,
  lob_id UUID NOT NULL REFERENCES public.lines_of_business(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | extracting | reconciling | ready | error
  status_message TEXT,
  source_files JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{name, path, size, type}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extraction_jobs TO authenticated;
GRANT ALL ON public.extraction_jobs TO service_role;
ALTER TABLE public.extraction_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs read own or admin" ON public.extraction_jobs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "jobs insert own" ON public.extraction_jobs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "jobs update own" ON public.extraction_jobs FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "jobs delete own" ON public.extraction_jobs FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Extraction rows (one per claim)
CREATE TABLE public.extraction_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.extraction_jobs(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  source_file TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  included_in_export BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX extraction_rows_job_idx ON public.extraction_rows (job_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extraction_rows TO authenticated;
GRANT ALL ON public.extraction_rows TO service_role;
ALTER TABLE public.extraction_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rows read via job" ON public.extraction_rows FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.extraction_jobs j WHERE j.id = job_id AND (j.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "rows write via job" ON public.extraction_rows FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.extraction_jobs j WHERE j.id = job_id AND (j.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.extraction_jobs j WHERE j.id = job_id AND (j.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);

-- Data quality issues
CREATE TABLE public.data_quality_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.extraction_jobs(id) ON DELETE CASCADE,
  row_id UUID REFERENCES public.extraction_rows(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'warning', -- info | warning | error
  code TEXT NOT NULL,
  field TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX dqi_job_idx ON public.data_quality_issues (job_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_quality_issues TO authenticated;
GRANT ALL ON public.data_quality_issues TO service_role;
ALTER TABLE public.data_quality_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dqi read via job" ON public.data_quality_issues FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.extraction_jobs j WHERE j.id = job_id AND (j.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "dqi write via job" ON public.data_quality_issues FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.extraction_jobs j WHERE j.id = job_id AND (j.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.extraction_jobs j WHERE j.id = job_id AND (j.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER templates_updated_at BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
