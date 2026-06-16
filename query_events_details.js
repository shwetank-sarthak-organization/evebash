require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: events, error: eventsErr } = await supabase
    .from('events')
    .select('id, title, type, parent_id')
    .in('title', ['New Sample New Event', 'Laptop', 'New Gallery Sample ', 'Mobile', 'Technology']);
    
  if (eventsErr) {
    console.error("Events error:", eventsErr);
    return;
  }
  
  events.forEach(e => console.log(`- [${e.id}] ${e.title} | Type: ${e.type} | parent_id: ${e.parent_id}`));
}

check();
