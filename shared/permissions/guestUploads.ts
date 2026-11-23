// Guest uploads (website and app). Off until todo #49 (Phase 2): the guest "Add photos" button doesn't work today,
// and admins (the owner by default, plus anyone they make admin) can already add, remove and manage media.
// While off: the "Upload" permission switch is hidden in Permissions and guests don't see "Add photos".
// Saved can_upload values in the database are kept; turning this on brings everything back.
export const GUEST_UPLOADS_ENABLED = false;
