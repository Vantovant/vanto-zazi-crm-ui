
-- 1) Temporarily disable validation trigger
DROP TRIGGER IF EXISTS validate_contact_enums_trigger ON contacts;

-- 2) Fix all invalid enum values
UPDATE contacts SET interest_level = 'Medium' WHERE interest_level NOT IN ('High', 'Medium', 'Low', '');
UPDATE contacts SET lead_path = 'Not sure yet' WHERE lead_path NOT IN ('Customer', 'Distributor', 'Not sure yet', 'Direct Registration', '');
UPDATE contacts SET focus_area = 'Both' WHERE focus_area NOT IN ('Health Transformation', 'Business Opportunity', 'Both', '');
UPDATE contacts SET lead_temperature = 'Warm' WHERE lead_temperature NOT IN ('Hot', 'Warm', 'Cold', '');
UPDATE contacts SET communication_status = 'New' WHERE communication_status NOT IN ('New', 'In Progress', 'Pending', 'Completed', 'Unsubscribed', 'Active', 'Contacted', '');
UPDATE contacts SET lead_type = 'Prospect' WHERE lead_type NOT IN ('Prospect', 'Registered_Nopurchase', 'Purchase_Nostatus', 'Purchase_Status', 'Expired', 'Customer', 'Distributor', '');
UPDATE contacts SET registration_status = 'Not Registered' WHERE registration_status NOT IN ('Not Registered', 'Registered', 'Activated', '');

-- 3) Auto-merge phone duplicates
DO $$
DECLARE
  grp RECORD;
  primary_rec RECORD;
  sec RECORD;
  merged_note TEXT;
  sec_ids UUID[];
BEGIN
  FOR grp IN
    SELECT user_id, phone_normalized
    FROM contacts
    WHERE phone_normalized IS NOT NULL
    GROUP BY user_id, phone_normalized
    HAVING count(*) > 1
  LOOP
    SELECT * INTO primary_rec
    FROM contacts
    WHERE user_id = grp.user_id AND phone_normalized = grp.phone_normalized
    ORDER BY updated_at DESC LIMIT 1;

    sec_ids := ARRAY[]::UUID[];
    merged_note := '';

    FOR sec IN
      SELECT * FROM contacts
      WHERE user_id = grp.user_id AND phone_normalized = grp.phone_normalized AND id != primary_rec.id
    LOOP
      sec_ids := sec_ids || sec.id;
      IF sec.additional_notes IS NOT NULL AND sec.additional_notes != '' THEN
        merged_note := merged_note || E'\n\n--- Merged ' || CURRENT_DATE || ' ---\n' || sec.additional_notes;
      END IF;
      IF primary_rec.email_address = '' AND sec.email_address != '' THEN
        UPDATE contacts SET email_address = sec.email_address WHERE id = primary_rec.id;
      END IF;
      IF primary_rec.city = '' AND sec.city != '' THEN
        UPDATE contacts SET city = sec.city WHERE id = primary_rec.id;
      END IF;
      IF primary_rec.province = '' AND sec.province != '' THEN
        UPDATE contacts SET province = sec.province WHERE id = primary_rec.id;
      END IF;
      IF primary_rec.sponsor_name = '' AND sec.sponsor_name != '' THEN
        UPDATE contacts SET sponsor_name = sec.sponsor_name WHERE id = primary_rec.id;
      END IF;
      IF primary_rec.aplgo_id = '' AND sec.aplgo_id != '' THEN
        UPDATE contacts SET aplgo_id = sec.aplgo_id WHERE id = primary_rec.id;
      END IF;
      IF primary_rec.go_status = '' AND sec.go_status != '' THEN
        UPDATE contacts SET go_status = sec.go_status WHERE id = primary_rec.id;
      END IF;
    END LOOP;

    IF merged_note != '' THEN
      UPDATE contacts 
      SET additional_notes = CASE 
        WHEN additional_notes != '' THEN additional_notes || merged_note
        ELSE ltrim(merged_note, E'\n')
      END
      WHERE id = primary_rec.id;
    END IF;

    UPDATE orders SET contact_id = primary_rec.id WHERE contact_id = ANY(sec_ids);
    UPDATE contact_activities SET contact_id = primary_rec.id WHERE contact_id = ANY(sec_ids);
    UPDATE ai_action_log SET contact_id = primary_rec.id WHERE contact_id = ANY(sec_ids);
    DELETE FROM contacts WHERE id = ANY(sec_ids);

    INSERT INTO merge_log (user_id, primary_id, merged_ids, key_type, key_value)
    VALUES (grp.user_id, primary_rec.id, sec_ids, 'phone', grp.phone_normalized);
  END LOOP;

  -- Email duplicates (after phone merge)
  FOR grp IN
    SELECT user_id, email_normalized
    FROM contacts
    WHERE email_normalized IS NOT NULL
    GROUP BY user_id, email_normalized
    HAVING count(*) > 1
  LOOP
    SELECT * INTO primary_rec
    FROM contacts
    WHERE user_id = grp.user_id AND email_normalized = grp.email_normalized
    ORDER BY updated_at DESC LIMIT 1;

    sec_ids := ARRAY[]::UUID[];
    merged_note := '';

    FOR sec IN
      SELECT * FROM contacts
      WHERE user_id = grp.user_id AND email_normalized = grp.email_normalized AND id != primary_rec.id
    LOOP
      sec_ids := sec_ids || sec.id;
      IF sec.additional_notes IS NOT NULL AND sec.additional_notes != '' THEN
        merged_note := merged_note || E'\n\n--- Merged ' || CURRENT_DATE || ' ---\n' || sec.additional_notes;
      END IF;
      IF primary_rec.phone_number = '' AND sec.phone_number != '' THEN
        UPDATE contacts SET phone_number = sec.phone_number WHERE id = primary_rec.id;
      END IF;
      IF primary_rec.city = '' AND sec.city != '' THEN
        UPDATE contacts SET city = sec.city WHERE id = primary_rec.id;
      END IF;
    END LOOP;

    IF merged_note != '' THEN
      UPDATE contacts 
      SET additional_notes = CASE 
        WHEN additional_notes != '' THEN additional_notes || merged_note
        ELSE ltrim(merged_note, E'\n')
      END
      WHERE id = primary_rec.id;
    END IF;

    UPDATE orders SET contact_id = primary_rec.id WHERE contact_id = ANY(sec_ids);
    UPDATE contact_activities SET contact_id = primary_rec.id WHERE contact_id = ANY(sec_ids);
    UPDATE ai_action_log SET contact_id = primary_rec.id WHERE contact_id = ANY(sec_ids);
    DELETE FROM contacts WHERE id = ANY(sec_ids);

    INSERT INTO merge_log (user_id, primary_id, merged_ids, key_type, key_value)
    VALUES (grp.user_id, primary_rec.id, sec_ids, 'email', grp.email_normalized);
  END LOOP;
END;
$$;

-- 4) Re-enable validation trigger
CREATE TRIGGER validate_contact_enums_trigger
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION validate_contact_enums();

-- 5) Apply unique partial indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_user_phone_unique 
  ON contacts (user_id, phone_normalized) 
  WHERE phone_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_user_email_unique 
  ON contacts (user_id, email_normalized) 
  WHERE email_normalized IS NOT NULL;
