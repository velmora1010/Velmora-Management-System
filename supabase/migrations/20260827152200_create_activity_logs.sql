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

-- Enable Row Level Security (RLS)
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to only insert activity logs matching their own auth user ID
CREATE POLICY "Users can only insert their own activity logs" ON public.activity_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow admin@velmora.com to read all activity logs
CREATE POLICY "Only admin can view all activity logs" ON public.activity_logs
    FOR SELECT USING (auth.jwt() ->> 'email' = 'admin@velmora.com');
