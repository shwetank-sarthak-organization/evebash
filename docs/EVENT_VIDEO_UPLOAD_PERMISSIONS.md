# Event video upload permissions

`can_upload` now grants photo uploads only. Event owners (including parent-event owners), approved event admins, delegated primary admins, and assigned event admins can upload videos. A member's `can_upload` flag does not grant video rights. A global role alone does not grant event video upload rights.

The backend validates the authenticated identity before issuing video upload credentials and when finalizing single, batch, or resumable uploads. Resumable part requests also inspect the stored upload session so removing admin access stops further video part credentials. File extension, MIME type, storage path, and media/resource type are considered together. Web checks the event-specific permission before showing video upload controls; native checks again before opening the video picker.

Business portfolios use the same transport with business-prefixed IDs. Their existing business-manager permissions remain separate from event permissions. Existing video files and read permissions are not changed.

## Rollout

1. Deploy the backend with `/api/media/video-upload-permission` and upload guards.
2. Apply `supabase/migrations/20261004010000_event_video_upload_permissions.sql` in the correct Supabase project. It adds restrictive insert/update policies to stop ordinary clients registering video metadata directly; existing photo authorization policies remain in effect. This migration has not been applied to the live database.
3. Deploy the web UI and distribute the mobile build. Older apps receive a permission error if an ordinary member attempts a video upload.
4. Check owner/admin photo and video uploads, member photo upload, member video rejection, and an upload resumed after admin access is revoked. Test a sub-gallery as well as its parent event.

Validation covers permission scoping, confirmed identity, pending/rejected admins, video type detection and unauthenticated endpoint bypass attempts. A disposable PostgreSQL test verified the migration accepts member photos, rejects member video inserts/updates, and permits owner videos. Native device testing remains necessary.
