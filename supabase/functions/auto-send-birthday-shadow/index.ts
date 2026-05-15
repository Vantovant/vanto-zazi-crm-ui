// supabase/functions/auto-send-birthday-shadow/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!
);

Deno.serve(async () => {
  // Get today's date in South Africa timezone
  const todaySA = new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' });
  const todayDate = new Date(todaySA).toISOString().split('T')[0]; // YYYY-MM-DD

  console.log(`Shadow run for SA date: ${todayDate}`);

  // Fetch birthdays for today that are not yet congratulated
  const { data: birthdays, error } = await supabase
    .from('contact_birthdays')
    .select(`
      id,
      associate_id,
      full_name,
      congratulate_by_date,
      contact_id,
      contacts (id, full_name, phone_normalized)
    `)
    .eq('congratulate_by_date', todayDate)
    .eq('status', 'not_congratulated')
    .not('contact_id', 'is', null);

  if (error) {
    console.error('Error fetching birthdays:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!birthdays || birthdays.length === 0) {
    console.log('No birthdays today.');
    return new Response(JSON.stringify({ message: 'No birthdays today' }), { status: 200 });
  }

  // Process each birthday
  for (const birthday of birthdays) {
    const contact = birthday.contacts;
    const hasPhone = contact?.phone_normalized && contact.phone_normalized.trim() !== '';
    const phoneLast4 = hasPhone ? contact.phone_normalized.slice(-4) : null;

    const logEntry = {
      log_date: todayDate,
      contact_id: birthday.contact_id,
      associate_id: birthday.associate_id,
      full_name: birthday.full_name,
      phone_last4: phoneLast4,
      message_type: 'birthday',
      composed_message: hasPhone 
        ? `🎂 Happy birthday ${birthday.full_name}! Wishing you a fantastic day.` 
        : null,
      would_have_sent: hasPhone,
      blocked_reason: hasPhone ? null : 'missing phone number',
      metadata: { congratulate_by_date: birthday.congratulate_by_date }
    };

    const { error: insertError } = await supabase
      .from('auto_send_shadow_log')
      .insert(logEntry);

    if (insertError) {
      console.error(`Failed to log for ${birthday.associate_id}:`, insertError);
    } else {
      console.log(`Logged shadow for ${birthday.associate_id} (hasPhone: ${hasPhone})`);
    }
  }

  return new Response(JSON.stringify({ processed: birthdays.length }), { status: 200 });
});