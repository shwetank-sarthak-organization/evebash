const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials (SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const USERNAME_PATTERN = /^(?!.*[._]{2})[a-z0-9](?:[a-z0-9._]{1,10}[a-z0-9])$/;

function isValidUsername(username) {
  return USERNAME_PATTERN.test((username || '').trim().toLowerCase());
}

function sanitizeBase(raw) {
  let u = (raw || '').toLowerCase().replace(/[^a-z0-9_.]/g, '_');
  u = u.replace(/_+/g, '_').replace(/\.+/g, '.');
  u = u.replace(/[._]{2,}/g, '_');
  u = u.replace(/^[._]+|[._]+$/g, '');
  if (u.length < 3) u = u ? 'user_' + u : 'user_1';
  if (u.length > 12) u = u.slice(0, 12).replace(/[._]+$/g, '');
  if (u.length < 3) u = u.padEnd(3, '0');
  return u;
}

function trimTo12Unique(username, claimedSet) {
  let base = sanitizeBase(username);
  let candidate = base;
  let counter = 1;

  while (claimedSet.has(candidate) || !isValidUsername(candidate)) {
    const suffix = counter.toString();
    const maxBase = 12 - suffix.length;
    let b = base.slice(0, maxBase).replace(/[._]+$/g, '');
    if (b.length < 2) b = 'u';
    candidate = b + suffix;
    if (!isValidUsername(candidate)) {
      candidate = 'u_' + suffix.padStart(2, '0');
    }
    counter++;
  }

  return candidate;
}

async function run() {
  console.log('Fetching profiles from database...');
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name, username, email');

  if (error) {
    console.error('Failed to fetch profiles:', error);
    process.exit(1);
  }

  console.log(`Fetched ${profiles.length} total profiles.`);

  // Claim all existing valid usernames <= 12 characters
  const claimedUsernames = new Set();
  profiles.forEach(p => {
    if (p.username && p.username.length <= 12 && isValidUsername(p.username)) {
      claimedUsernames.add(p.username.toLowerCase());
    }
  });

  const targets = profiles.filter(p => p.username && p.username.length > 12);
  console.log(`Found ${targets.length} profiles with username > 12 characters.\n`);

  if (targets.length === 0) {
    console.log('All usernames already satisfy <= 12 characters.');
    return;
  }

  const updates = [];
  for (const target of targets) {
    const newUsername = trimTo12Unique(target.username, claimedUsernames);
    claimedUsernames.add(newUsername);
    updates.push({
      id: target.id,
      name: target.name,
      email: target.email,
      oldUsername: target.username,
      newUsername,
    });
  }

  console.log('Executing updates:');
  for (const update of updates) {
    console.log(`- Updating [${update.id}]: "${update.oldUsername}" -> "${update.newUsername}" (len: ${update.newUsername.length})`);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username: update.newUsername })
      .eq('id', update.id);

    if (updateError) {
      console.error(`  ERROR updating user ${update.id}:`, updateError);
    } else {
      console.log(`  ✓ Successfully updated to "${update.newUsername}"`);
    }
  }

  // Post-verification
  console.log('\n--- Post-Verification ---');
  const { data: verifiedProfiles, error: verifyError } = await supabase
    .from('profiles')
    .select('id, name, username');

  if (verifyError) {
    console.error('Verification query failed:', verifyError);
    return;
  }

  const stillLong = verifiedProfiles.filter(p => p.username && p.username.length > 12);
  const allUsernames = verifiedProfiles.map(p => p.username).filter(Boolean);
  const duplicates = allUsernames.filter((item, index) => allUsernames.indexOf(item) !== index);

  console.log(`Total profiles checked: ${verifiedProfiles.length}`);
  console.log(`Profiles with username > 12: ${stillLong.length}`);
  console.log(`Duplicate usernames found: ${duplicates.length} ${duplicates.length > 0 ? JSON.stringify(duplicates) : ''}`);

  if (stillLong.length === 0 && duplicates.length === 0) {
    console.log('✅ ALL USERNAMES SUCCESSFULLY VERIFIED (<=12 chars and completely unique).');
  } else {
    console.error('❌ Verification found issues!');
  }
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
