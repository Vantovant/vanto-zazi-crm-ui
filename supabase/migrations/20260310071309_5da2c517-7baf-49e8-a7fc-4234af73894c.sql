
CREATE OR REPLACE FUNCTION public.validate_order_purchase_type()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.purchase_type NOT IN ('Online', 'Offline', 'Activity', 'Upgrade', '') THEN
    RAISE EXCEPTION 'Invalid purchase_type: %', NEW.purchase_type;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_order_purchase_type_trigger
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_purchase_type();
