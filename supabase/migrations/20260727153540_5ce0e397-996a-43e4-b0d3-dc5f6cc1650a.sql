
-- Fix tg_updated_at search_path
CREATE OR REPLACE FUNCTION public.tg_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Storage RLS: users manage files under their own uid/ prefix; admins see all
CREATE POLICY "own uploads read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('loss-run-uploads','template-uploads','exports')
       AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "own uploads insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('loss-run-uploads','template-uploads','exports')
       AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "own uploads update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('loss-run-uploads','template-uploads','exports')
       AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "own uploads delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('loss-run-uploads','template-uploads','exports')
       AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));
