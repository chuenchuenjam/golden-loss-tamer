ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'Custom';
ALTER TABLE public.templates ADD CONSTRAINT templates_label_check CHECK (label IN ('System','Custom','Carrier'));
UPDATE public.templates SET label = 'System' WHERE is_system = true;