require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  // Find user by email
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', 'newone@email.com');
    
  if (profileErr) {
    console.error("Profile error:", profileErr);
    return;
  }
  
  if (!profiles || profiles.length === 0) {
    console.log("User newone@email.com not found in profiles table.");
    // Wait, let's also query events by created_by = 'newone@email.com' just in case
  }
  
  const ids = profiles.map(p => p.id);
  ids.push('newone@email.com'); // because sometimes created_by stores the email

  const { data: events, error: eventsErr } = await supabase
    .from('events')
    .select('id, title, created_by')
    .in('created_by', ids);
    
  if (eventsErr) {
    console.error("Events error:", eventsErr);
    return;
  }
  
  console.log(`Found ${events.length} events created by newone@email.com:`);
  events.forEach(e => console.log(`- [${e.id}] ${e.title} (created_by: ${e.created_by})`));
}

check();
