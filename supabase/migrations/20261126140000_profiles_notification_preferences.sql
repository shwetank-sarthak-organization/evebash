-- Issue #58: profiles never had a notification_preferences column, but the apps' Settings switches and several push
-- lookups use it. Nullable, no default: an empty value already means "everything on" in every reader
-- (wantsEventInvites, sendPushNotification, the Settings screen), so adding it changes no existing behaviour.
alter table public.profiles add column if not exists notification_preferences jsonb;
