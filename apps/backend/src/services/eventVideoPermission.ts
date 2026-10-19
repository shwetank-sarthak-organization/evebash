import type { SupabaseClient, User } from '@supabase/supabase-js';

export function isVideoUpload(value: Record<string, unknown>) {
  return [value.resourceType, value.mediaType, value.media_type, value.resource_type].includes('video')
    || String(value.contentType || value.mimeType || '').toLowerCase().startsWith('video/')
    || [value.fileName, value.storageKey].some(v => /\.(mp4|mov|m4v|webm|avi|mkv|3gp|mpeg|mpg|m3u8|flv|wmv|mts|m2ts|ts|ogv)(?:[?#]|$)/i.test(String(v || '')))
    || String(value.storageKey || '').includes('/videos/');
}

type UploadRole = 'manager' | 'uploader' | 'none';

/**
 * What the user may upload to a gallery: "manager" (owner of the gallery or its parent, platform admin, delegated
 * host, assigned event admin or guest admin) may post photos and videos; "uploader" (approved guest whose host turned
 * on "Allow Photo Uploads") may post photos only.
 */
export async function eventUploadRole(db: SupabaseClient, user: User, eventId: string): Promise<UploadRole> {
  const { data: event, error } = await db.from('events').select('id,created_by,parent_id').eq('id', eventId).maybeSingle();
  if (error) throw error;
  if (!event) {
    // Business portfolios share the upload transport but are not event galleries.
    if (!eventId.startsWith('business-')) return 'none';
    const { data: business, error } = await db.from('businesses').select('created_by,admins,allowed_users,owner_email').eq('id', eventId.slice('business-'.length)).maybeSingle();
    if (error) throw error;
    return business && (business.created_by === user.id || business.admins?.includes(user.id) || business.allowed_users?.includes(user.id) || (user.email_confirmed_at && business.owner_email === user.email)) ? 'manager' : 'none';
  }
  const owners = [event.created_by];
  const ids = [event.id];
  if (event.parent_id) {
    const { data: parent, error } = await db.from('events').select('id,created_by').eq('id', event.parent_id).maybeSingle();
    if (error) throw error;
    if (parent) { owners.push(parent.created_by); ids.push(parent.id); }
  }
  if (owners.includes(user.id)) return 'manager';
  const { data: profile, error: profileError } = await db.from('profiles').select('role,role_type,delegated_by').eq('id', user.id).maybeSingle();
  if (profileError) throw profileError;
  // Platform admin: same rule as eb_private.is_platform_admin in the database
  if (profile?.role === 'admin' && !profile.delegated_by) return 'manager';
  if (profile?.role_type === 'primary' && owners.includes(profile.delegated_by)) return 'manager';
  const { data: assigned, error: assignedError } = await db.from('profile_assigned_events').select('event_id').eq('profile_id', user.id).in('event_id', ids);
  if (assignedError) throw assignedError;
  if (profile?.role_type === 'event' && assigned?.length) return 'manager';
  // guests has no email column: rows are matched by user_id; old rows kept the email or phone in guests.phone.
  const legacyIdentities = [user.email_confirmed_at ? user.email?.toLowerCase() : undefined, user.phone_confirmed_at ? user.phone : undefined].filter((v): v is string => Boolean(v));
  const lookups: Array<[string, string[]]> = [['user_id', [user.id]], ['phone', legacyIdentities]];
  let role: UploadRole = 'none';
  for (const eventColumn of ['event_id', 'parent_event_id']) {
    for (const [identityColumn, identities] of lookups) {
      if (!identities.length) continue;
      const { data, error } = await db.from('guests').select('can_admin,can_upload').eq('status', 'approved').in(eventColumn, ids).in(identityColumn, identities);
      if (error) throw error;
      if (data?.some(row => row.can_admin)) return 'manager';
      if (data?.some(row => row.can_upload)) role = 'uploader';
    }
  }
  return role;
}

/** Videos: managers only. Photo-upload permission (can_upload) never grants video uploads. */
export async function canPostEventVideo(db: SupabaseClient, user: User, eventId: string): Promise<boolean> {
  return (await eventUploadRole(db, user, eventId)) === 'manager';
}

/** Photos: managers, and approved guests whose host turned on "Allow Photo Uploads". */
export async function canPostEventPhoto(db: SupabaseClient, user: User, eventId: string): Promise<boolean> {
  return (await eventUploadRole(db, user, eventId)) !== 'none';
}

/**
 * Photo uploads to galleries need permission (issue #40: before, anyone who knew a gallery's id got an upload link,
 * even logged out). Kill switch: PHOTO_UPLOADS_REQUIRE_PERMISSION=false goes back to the old behaviour (videos are
 * always checked).
 */
export function isPhotoUploadPermissionRequired() {
  return process.env.PHOTO_UPLOADS_REQUIRE_PERMISSION?.trim().toLowerCase() !== 'false';
}
