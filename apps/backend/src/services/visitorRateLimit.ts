import type { Request } from "express";
import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";

/**
 * Who is asking: X-Real-IP, which Railway's edge sets to the client's address ("for identifying client's remote IP"),
 * else the connection's own address. Not X-Forwarded-For: Railway passes the caller's own entries through, so it can
 * be made up, while made-up X-Real-IP values are replaced (both checked on staging 2026-11-25, issue #320). IPv6 is
 * grouped by /56.
 */
export function visitorAddressKey(realIp: string | string[] | undefined, socketAddress: string | undefined) {
  const address = (Array.isArray(realIp) ? realIp[0] : realIp)?.split(",")[0]?.trim();
  return ipKeyGenerator(address || socketAddress || "unknown", 56);
}

export function requestVisitorKey(request: Request) {
  return visitorAddressKey(request.headers["x-real-ip"], request.socket.remoteAddress);
}

// Issue #326: on unless "false". Off: limits are keyed by req.ip as before, which behind Railway's proxy is the proxy's
// address, so each limit is one budget shared by everyone.
export function isRateLimitByVisitorOn() {
  return process.env.RATE_LIMIT_BY_VISITOR?.trim().toLowerCase() !== "false";
}

/** express-rate-limit with one budget per visitor (X-Real-IP) instead of per req.ip (issue #326) */
export function visitorRateLimit(options: Partial<Options>) {
  return rateLimit({
    ...options,
    keyGenerator: (request) => (isRateLimitByVisitorOn() ? requestVisitorKey(request) : ipKeyGenerator(request.ip ?? "", 56)),
    // The key doesn't use X-Forwarded-For, so the library's proxy checks don't apply
    validate: { xForwardedForHeader: false },
  });
}
