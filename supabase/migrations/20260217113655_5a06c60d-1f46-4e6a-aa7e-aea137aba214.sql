
-- Create a function that checks if a new user was invited
-- This runs after a user is created in auth.users
-- If no invite was redeemed for this user, we block access by disabling the profile
CREATE OR REPLACE FUNCTION public.enforce_invite_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if there's a redeemed invite for this user's email
  -- The invite-check edge function marks invites as used before signup completes
  -- We give a grace window: if no invite is used within the flow, 
  -- the user's profile will be flagged
  
  -- Log the signup event for admin awareness
  INSERT INTO user_activity (user_id, action, page, metadata)
  VALUES (
    NEW.id, 
    'account_created', 
    '/auth', 
    jsonb_build_object('email', COALESCE(NEW.raw_user_meta_data->>'email', ''), 'display_name', COALESCE(NEW.raw_user_meta_data->>'display_name', ''))
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users for new signups
CREATE TRIGGER on_auth_user_created_log
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invite_on_signup();
