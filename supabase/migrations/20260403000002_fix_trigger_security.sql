-- Drop and recreate the trigger function with proper security settings
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Recreate function with proper security and error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_type_value TEXT;
BEGIN
  -- Extract user_type from auth.users.raw_user_meta_data
  user_type_value := NEW.raw_user_meta_data->>'user_type';
  
  -- Log for debugging
  RAISE LOG 'handle_new_user triggered for user % with type %', NEW.id, user_type_value;
  
  -- Only create records for owner or agency
  IF user_type_value IN ('owner', 'agency') THEN
    -- Create user profile
    INSERT INTO public.user_profiles (id, full_name, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
      NEW.raw_user_meta_data->>'phone'
    );
    
    RAISE LOG 'Created user_profile for user %', NEW.id;
    
    -- Create user permission with role
    INSERT INTO public.user_permissions (user_id, role)
    VALUES (
      NEW.id,
      user_type_value::public.user_role
    );
    
    RAISE LOG 'Created user_permission for user % with role %', NEW.id, user_type_value;
  ELSE
    RAISE LOG 'Skipping profile creation for personal user %', NEW.id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error details
    RAISE LOG 'Error in handle_new_user for user %: % %', NEW.id, SQLERRM, SQLSTATE;
    -- Re-raise to fail the signup so we can see the error
    RAISE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

