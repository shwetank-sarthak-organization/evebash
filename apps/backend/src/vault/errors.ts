export type VaultErrorCode =
  | "unauthenticated"
  | "disabled"
  | "invalid_input"
  | "not_found"
  | "invalid_move"
  | "quota_exceeded"
  | "file_too_large"
  | "plan_expired"
  | "size_mismatch"
  | "upload_incomplete"
  | "name_conflict";

const STATUS: Record<VaultErrorCode, number> = {
  unauthenticated: 401,
  disabled: 503,
  invalid_input: 400,
  not_found: 404,
  invalid_move: 400,
  quota_exceeded: 413,
  file_too_large: 413,
  plan_expired: 403,
  size_mismatch: 422,
  upload_incomplete: 409,
  name_conflict: 409,
};

export class VaultError extends Error {
  readonly status: number;
  constructor(readonly code: VaultErrorCode, message: string) {
    super(message);
    this.status = STATUS[code];
  }
}

const DATABASE_CODES: Record<string, [VaultErrorCode, string]> = {
  vault_not_found: ["not_found", "That file or folder no longer exists."],
  vault_quota_exceeded: ["quota_exceeded", "There isn't enough storage left on your plan for this."],
  vault_invalid_move: ["invalid_move", "A folder can't be moved into itself or one of its own folders."],
};

/** Turns the database function errors (raise exception 'vault_…') into user-facing errors. */
export function toVaultError(error: unknown): VaultError | null {
  if (error instanceof VaultError) return error;
  const message = typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  const known = DATABASE_CODES[message];
  if (known) return new VaultError(known[0], known[1]);
  if (code === "23505") return new VaultError("name_conflict", "Something with that name was just created here. Please try again.");
  return null;
}
