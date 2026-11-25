import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { visitorAddressKey, visitorRateLimit } from "../src/services/visitorRateLimit.js";

function withSwitch(t: { after: (fn: () => void) => void }, value: string | undefined) {
  const before = process.env.RATE_LIMIT_BY_VISITOR;
  if (value === undefined) delete process.env.RATE_LIMIT_BY_VISITOR;
  else process.env.RATE_LIMIT_BY_VISITOR = value;
  t.after(() => {
    if (before === undefined) delete process.env.RATE_LIMIT_BY_VISITOR;
    else process.env.RATE_LIMIT_BY_VISITOR = before;
  });
}

async function startServer(t: { after: (fn: () => void) => void }) {
  const app = express();
  app.use("/limited", visitorRateLimit({
    windowMs: 60_000,
    limit: 2,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Too many requests." },
  }), (_request, response) => { response.json({ ok: true }); });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/limited`;
  return (realIp?: string, forwardedFor?: string) => fetch(url, {
    headers: { ...(realIp ? { "X-Real-IP": realIp } : {}), ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}) },
  }).then(response => response.status);
}

test("visitor key: X-Real-IP, else the connection; IPv6 grouped by /56", () => {
  assert.equal(visitorAddressKey("198.51.100.1", "10.0.0.1"), "198.51.100.1");
  assert.equal(visitorAddressKey([" 198.51.100.1 "], undefined), "198.51.100.1");
  assert.equal(visitorAddressKey(undefined, "::ffff:192.0.2.5"), "192.0.2.5");
  assert.equal(visitorAddressKey("2001:db8:abcd:12:1:2:3:4", undefined), "2001:db8:abcd::/56");
  assert.equal(visitorAddressKey("", undefined), "unknown");
});

test("switch on (default): each visitor has their own budget; X-Forwarded-For doesn't matter (issue #326)", async (t) => {
  withSwitch(t, undefined);
  const send = await startServer(t);
  assert.deepEqual([await send("198.51.100.1"), await send("198.51.100.1"), await send("198.51.100.1")], [200, 200, 429]);
  assert.equal(await send("198.51.100.1", "203.0.113.50"), 429);
  assert.deepEqual([await send("198.51.100.2"), await send("198.51.100.2")], [200, 200]);
});

test("switch off: one budget for every request from the same connection address, as before (issue #326)", async (t) => {
  withSwitch(t, "false");
  const send = await startServer(t);
  assert.deepEqual([await send("198.51.100.1"), await send("198.51.100.2"), await send("198.51.100.3")], [200, 200, 429]);
});
