-- ═══════════════════════════════════════════════════════════════
-- Auth System Migration
-- Creates user_profiles and user_permissions tables
-- 
-- Role Detection Logic:
-- - No user_permissions record → personal user
-- - user_permissions.role = 'owner' → owner user
-- - user_permissions.role = 'agency' → agency user
-- - user_permissions.role = 'admin' → admin user (future)
-- 
-- Personal users have NO database records at all
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- ENUMS
-- ───────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('owner', 'agency', 'admin');

-- ───────────────────────────────────────────────────────────────
-- TABLES
-- ───────────────────────────────────────────────────────────────

-- User profiles (only for owner & agency, NOT for personal users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_profiles IS 'Extended user data for owner and agency users only. Personal users have no profile record.';
COMMENT ON COLUMN user_profiles.is_active IS 'Soft delete flag. Inactive users cannot access the system.';

-- User permissions (defines user roles)
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

COMMENT ON TABLE user_permissions IS 'Defines user roles. If no record exists, user is "personal". Users can have multiple roles.';
COMMENT ON COLUMN user_permissions.role IS 'owner (مالك), agency (مكتب عقاري), or admin (future)';

-- ───────────────────────────────────────────────────────────────
-- INDEXES
-- ───────────────────────────────────────────────────────────────

CREATE INDEX idx_user_profiles_is_active ON user_profiles(is_active);
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_role ON user_permissions(role);

-- ───────────────────────────────────────────────────────────────
-- TRIGGERS
-- ───────────────────────────────────────────────────────────────

-- Auto-update updated_at timestamp on every UPDATE
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-create user_profile AND user_permission ONLY for owner/agency signups
-- Personal users get NO database records at all
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_type_value TEXT;
BEGIN
  -- Extract user_type from auth.users.raw_user_meta_data
  user_type_value := NEW.raw_user_meta_data->>'user_type';
  
  -- Only create records for owner or agency
  -- Personal users are intentionally skipped (no records created)
  IF user_type_value IN ('owner', 'agency') THEN
    -- Create user profile
    INSERT INTO public.user_profiles (id, full_name, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
      NEW.raw_user_meta_data->>'phone'
    );
    
    -- Create user permission with role
    INSERT INTO public.user_permissions (user_id, role)
    VALUES (
      NEW.id,
      user_type_value::user_role
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

COMMENT ON FUNCTION handle_new_user() IS 'Creates user_profiles and user_permissions for owner/agency signups. Personal users get NO records.';

