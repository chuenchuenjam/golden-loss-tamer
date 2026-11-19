ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lob_id uuid REFERENCES public.lines_of_business(id) ON DELETE SET NULL;
DROP POLICY IF EXISTS "lob read authed" ON public.lines_of_business;
CREATE POLICY "lob read active or admin" ON public.lines_of_business FOR SELECT TO authenticated
USING (active OR public.has_role(auth.uid(), 'admin'::public.app_role));