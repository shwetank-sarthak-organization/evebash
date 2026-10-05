import type { SupabaseClient, User } from '@supabase/supabase-js';

export function isVideoUpload(value: Record<string, unknown>) {
  return [value.resourceType, value.mediaType, value.media_type, value.resource_type].includes('video')
    || String(value.contentType || value.mimeType || '').toLowerCase().startsWith('video/')
    || [value.fileName, value.storageKey].some(v => /\.(mp4|mov|m4v|webm|avi|mkv|3gp|mpeg|mpg|m3u8|flv|wmv|mts|m2ts|ts|ogv)(?:[?#]|$)/i.test(String(v || '')))
    || String(value.storageKey || '').includes('/videos/');
}

export async function canPostEventVideo(db: SupabaseClient, user: User, eventId: string): Promise<boolean> {
  const { data: event, error } = await db.from('events').select('id,created_by,parent_id').eq('id', eventId).maybeSingle();
  if (error) throw error;
  if (!event) {
    // Business portfolios share the upload transport but are not event galleries.
    if (!eventId.startsWith('business-')) return false;
    const { data: business, error } = await db.from('businesses').select('created_by,admins,allowed_users,owner_email').eq('id', eventId.slice('business-'.length)).maybeSingle();
    if (error) throw error;
    return Boolean(business && (business.created_by === user.id || business.admins?.includes(user.id) || business.allowed_users?.includes(user.id) || (user.email_confirmed_at && business.owner_email === user.email)));
  }
  const owners = [event.created_by];
  const ids = [event.id];
  if (event.parent_id) {
    const { data: parent, error } = await db.from('events').select('id,created_by').eq('id', event.parent_id).maybeSingle();
    if (error) throw error;
    if (parent) { owners.push(parent.created_by); ids.push(parent.id); }
  }
  if (owners.includes(user.id)) return true;
  const { data: profile, error: profileError } = await db.from('profiles').select('role,role_type,delegated_by').eq('id', user.id).maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role_type === 'primary' && owners.includes(profile.delegated_by)) return true;
  const { data: assigned, error: assignedError } = await db.from('profile_assigned_events').select('event_id').eq('profile_id', user.id).in('event_id', ids);
  if (assignedError) throw assignedError;
  if (profile?.role_type === 'event' && assigned?.length) return true;
  const identities = [user.id, user.email_confirmed_at ? user.email?.toLowerCase() : undefined, user.phone_confirmed_at ? user.phone : undefined].filter((v): v is string => Boolean(v));
  for (const eventColumn of ['event_id', 'parent_event_id']) {
    for (const identityColumn of ['email', 'phone']) {
      const { data, error } = await db.from('guests').select('id').eq('status', 'approved').eq('can_admin', true).in(eventColumn, ids).in(identityColumn, identities).limit(1);
      if (error) throw error;
      if (data?.length) return true;
    }
  }
  // Photo-upload permission (can_upload) never grants video-upload permission.
  return false;
}
