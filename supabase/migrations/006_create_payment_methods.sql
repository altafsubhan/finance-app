-- Create payment_methods table
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Ensure get_partner_uids() function exists (from migration 004)
-- If it doesn't exist, create it
CREATE OR REPLACE FUNCTION get_partner_uids()
RETURNS SETOF uuid
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT id FROM public.profiles;
END;
$$;

-- Create policies for payment_methods (shared access like other tables)
CREATE POLICY "Partners can view all payment methods" ON public.payment_methods
  FOR SELECT USING (auth.uid() IN (SELECT get_partner_uids()));

CREATE POLICY "Partners can insert payment methods" ON public.payment_methods
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT get_partner_uids()));

CREATE POLICY "Partners can update all payment methods" ON public.payment_methods
  FOR UPDATE USING (auth.uid() IN (SELECT get_partner_uids()));

CREATE POLICY "Partners can delete all payment methods" ON public.payment_methods
  FOR DELETE USING (auth.uid() IN (SELECT get_partner_uids()));

-- Insert default payment methods
INSERT INTO public.payment_methods (name) VALUES
  ('BOA Travel'),
  ('BOA CB'),
  ('Chase Sapphire'),
  ('Chase Amazon'),
  ('Mano Chase Freedom'),
  ('Sobi Chase Freedom'),
  ('Mano Discover'),
  ('Sobi Discover'),
  ('Mano Amex'),
  ('Subi Chase Debit'),
  ('BILT'),
  ('Cash'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

