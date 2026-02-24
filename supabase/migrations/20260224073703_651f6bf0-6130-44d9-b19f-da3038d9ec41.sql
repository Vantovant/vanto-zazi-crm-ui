CREATE OR REPLACE FUNCTION public.validate_contact_enums()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.lead_temperature NOT IN ('Hot', 'Warm', 'Cold', '') THEN
    RAISE EXCEPTION 'Invalid lead_temperature: %', NEW.lead_temperature;
  END IF;

  IF NEW.communication_status NOT IN ('New', 'In Progress', 'Pending', 'Completed', 'Unsubscribed', 'Active', 'Contacted', '') THEN
    RAISE EXCEPTION 'Invalid communication_status: %', NEW.communication_status;
  END IF;

  IF NEW.lead_type NOT IN ('Prospect', 'Registered_Nopurchase', 'Purchase_Nostatus', 'Purchase_Status', 'Expired', 'Customer', 'Distributor', '') THEN
    RAISE EXCEPTION 'Invalid lead_type: %', NEW.lead_type;
  END IF;

  IF NEW.interest_level NOT IN ('High', 'Medium', 'Low', '') THEN
    RAISE EXCEPTION 'Invalid interest_level: %', NEW.interest_level;
  END IF;

  IF NEW.registration_status NOT IN ('Not Registered', 'Registered', 'Activated', '') THEN
    RAISE EXCEPTION 'Invalid registration_status: %', NEW.registration_status;
  END IF;

  IF NEW.lead_path NOT IN ('Customer', 'Distributor', 'Not sure yet', 'Direct Registration', '') THEN
    RAISE EXCEPTION 'Invalid lead_path: %', NEW.lead_path;
  END IF;

  IF NEW.focus_area NOT IN ('Health Transformation', 'Business Opportunity', 'Both', '') THEN
    RAISE EXCEPTION 'Invalid focus_area: %', NEW.focus_area;
  END IF;

  RETURN NEW;
END;
$function$;