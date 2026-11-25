import { Router, type Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { getSupabaseAdminClient } from "../supabase.js";

type AuthDirectory = Pick<ReturnType<typeof getSupabaseAdminClient>["auth"]["admin"], "listUsers">;

const WINDOW_MS = 15 * 60 * 1000;
const CHECKS_PER_VISITOR = 20;
const CHECKS_FOR_EVERYONE = 60;
const TOO_MANY = "Too many signup checks. Please try again later.";

// Issue #320: each visitor gets their own budget before the shared one, and a limit answer says "rate_limited" so the
// website signs up without the check. Off ("false"): only the shared budget, answered as before.
export function isSignupPerVisitorLimitOn() {
  return process.env.SIGNUP_CHECK_PER_VISITOR?.trim().toLowerCase() !== "false";
}

/**
 * Who is asking: X-Real-IP, which Railway's edge sets to the client's address ("for identifying client's remote IP"),
 * else the connection's own address. Not X-Forwarded-For: Railway passes the caller's own entries through (checked on
 * staging 2026-11-25), so it can be made up. IPv6 is grouped by /56.
 */
export function signupVisitorKey(realIp: string | string[] | undefined, socketAddress: string | undefined) {
  const address = (Array.isArray(realIp) ? realIp[0] : realIp)?.split(",")[0]?.trim();
  return ipKeyGenerator(address || socketAddress || "unknown", 56);
}

function tooManyAnswer() {
  return isSignupPerVisitorLimitOn() ? { error: TOO_MANY, code: "rate_limited" } : { error: TOO_MANY };
}

export async function authEmailExists(directory: AuthDirectory, email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await directory.listUsers({ page, perPage });
    if (error) throw error;
    if (data.users.some(user => user.email?.trim().toLowerCase() === normalized)) return true;
    if (data.users.length < perPage) return false;
  }
}

export function createSignupRouter(getDirectory: () => AuthDirectory = () => getSupabaseAdminClient().auth.admin) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  // First, so one visitor who is over their own budget stops using up the shared one
  router.use(rateLimit({
    windowMs: WINDOW_MS,
    limit: CHECKS_PER_VISITOR,
    skip: () => !isSignupPerVisitorLimitOn(),
    keyGenerator: (req: Request) => signupVisitorKey(req.headers["x-real-ip"], req.socket.remoteAddress),
    standardHeaders: false,
    legacyHeaders: false,
    // The key doesn't use X-Forwarded-For or req.ip, so the library's proxy checks don't apply
    validate: { xForwardedForHeader: false },
    message: tooManyAnswer,
  }));
  router.use(rateLimit({
    windowMs: WINDOW_MS,
    // A service-wide budget also works behind Railway's proxy without trusting
    // client-supplied forwarding headers or grouping users by a proxy IP.
    limit: CHECKS_FOR_EVERYONE,
    keyGenerator: () => "signup-auth-directory",
    standardHeaders: true,
    legacyHeaders: false,
    message: tooManyAnswer,
  }));
  router.post("/check-email", async (req, res) => {
    const input = z.object({ email: z.string().trim().email().max(254) }).safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }
    try {
      const exists = await authEmailExists(getDirectory(), input.data.email);
      res.json({ exists });
    } catch {
      // Never report an email as available if the Auth directory could not be checked.
      res.status(503).json({ error: "Unable to check your email right now. Please try again later." });
    }
  });
  return router;
}
