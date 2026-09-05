-- Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email text NOT NULL,
    department text NOT NULL,
    action text NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can only insert their own activity logs" ON public.activity_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Only admin can view all activity logs" ON public.activity_logs
    FOR SELECT USING (auth.jwt() ->> 'email' = 'admin@velmora.com');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
