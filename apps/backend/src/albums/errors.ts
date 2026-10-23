export type AlbumErrorCode =
  | "unauthenticated"
  | "disabled"
  | "forbidden"
  | "invalid_input"
  | "not_found"
  | "limit_reached"
  | "file_too_large"
  | "unsupported_file"
  | "storage_full"
  | "plan_expired"
  | "album_approved"
  | "nothing_to_send"
  | "not_ready";

const STATUS: Record<AlbumErrorCode, number> = {
  unauthenticated: 401,
  disabled: 503,
  forbidden: 403,
  invalid_input: 400,
  not_found: 404,
  limit_reached: 409,
  file_too_large: 413,
  unsupported_file: 415,
  storage_full: 413,
  plan_expired: 403,
  album_approved: 409,
  nothing_to_send: 409,
  not_ready: 409,
};

export class AlbumError extends Error {
  readonly status: number;
  constructor(readonly code: AlbumErrorCode, message: string) {
    super(message);
    this.status = STATUS[code];
  }
}

const DATABASE_CODES: Record<string, [AlbumErrorCode, string]> = {
  album_not_found: ["not_found", "That album no longer exists."],
  album_page_not_found: ["not_found", "That page no longer exists."],
  album_page_limit: ["limit_reached", "This album already has the most pages it can hold."],
  album_approved: ["album_approved", "This album is approved. Reopen it to make changes."],
  album_nothing_to_send: ["nothing_to_send", "There are no new pages to send. Upload a page or a new version first."],
  album_reorder_mismatch: ["invalid_input", "The pages changed while you were reordering. Refresh and try again."],
};

/** Turns the database function errors (raise exception 'album_…') into user-facing errors. */
export function toAlbumError(error: unknown): AlbumError | null {
  if (error instanceof AlbumError) return error;
  const message = typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  const known = DATABASE_CODES[message];
  return known ? new AlbumError(known[0], known[1]) : null;
}
