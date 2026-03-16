
-- system_profiles table
CREATE TABLE public.system_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  system_identifier text NOT NULL,
  system_environment text NOT NULL,
  gamp_category text NOT NULL,
  description text NOT NULL DEFAULT '',
  intended_use text NOT NULL DEFAULT '',
  gxp_classification text NOT NULL,
  risk_level text NOT NULL,
  status text NOT NULL DEFAULT 'Active',
  vendor_name text NOT NULL DEFAULT '',
  vendor_contact text NOT NULL DEFAULT '',
  vendor_contract_ref text NOT NULL DEFAULT '',
  owner_id text NOT NULL DEFAULT '',
  system_owner_id text NOT NULL DEFAULT '',
  system_admin_id text NOT NULL DEFAULT '',
  qa_id text NOT NULL DEFAULT '',
  it_manager_id text,
  validation_date date NOT NULL,
  review_period_months integer NOT NULL DEFAULT 12,
  next_review_date date NOT NULL,
  -- Audit columns
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  -- Soft delete
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);

-- updated_at trigger
CREATE TRIGGER update_system_profiles_updated_at
  BEFORE UPDATE ON public.system_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.system_profiles ENABLE ROW LEVEL SECURITY;

-- Authenticated users can SELECT their own (non-deleted) records
CREATE POLICY "Users can view own system profiles"
  ON public.system_profiles FOR SELECT TO authenticated
  USING (created_by = auth.uid() AND is_deleted = false);

-- Super users can view all non-deleted records
CREATE POLICY "Super users can view all system profiles"
  ON public.system_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_user') AND is_deleted = false);

-- Authenticated users can INSERT their own records
CREATE POLICY "Users can create system profiles"
  ON public.system_profiles FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Authenticated users can UPDATE their own records
CREATE POLICY "Users can update own system profiles"
  ON public.system_profiles FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND is_deleted = false)
  WITH CHECK (created_by = auth.uid());
