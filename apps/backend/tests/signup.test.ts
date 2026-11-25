import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { authEmailExists, createSignupRouter, signupVisitorKey } from "../src/routes/signup.js";

async function startSignupServer(t: { after: (fn: () => void) => void }) {
  let calls = 0;
  const app = express();
  app.use(express.json());
  app.use("/signup", createSignupRouter(() => ({ async listUsers() {
    calls++;
    return { data: { users: [{ email: "existing@example.com" }] }, error: null };
  } } as any)));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/signup/check-email`;
  const send = (email: unknown, forwardedFor?: string) => fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}) },
    body: JSON.stringify({ email }),
  });
  return { send, calls: () => calls };
}

function withSwitch(t: { after: (fn: () => void) => void }, value: string | undefined) {
  const before = process.env.SIGNUP_CHECK_PER_VISITOR;
  if (value === undefined) delete process.env.SIGNUP_CHECK_PER_VISITOR;
  else process.env.SIGNUP_CHECK_PER_VISITOR = value;
  t.after(() => {
    if (before === undefined) delete process.env.SIGNUP_CHECK_PER_VISITOR;
    else process.env.SIGNUP_CHECK_PER_VISITOR = before;
  });
}

test("Auth lookup finds email and Google identities without a profile, including later pages", async () => {
  for (const provider of ["email", "google"]) {
    const pages: number[] = [];
    const directory = { async listUsers({ page }: { page: number }) {
      pages.push(page);
      return { error: null, data: { users: page === 1
        ? Array.from({ length: 1000 }, (_, i) => ({ email: `other${i}@example.com` }))
        : [{ email: "Existing@Example.com", app_metadata: { provider } }] } };
    } };
    assert.equal(await authEmailExists(directory as any, " existing@example.com "), true);
    assert.deepEqual(pages, [1, 2]);
  }
  assert.equal(await authEmailExists({ listUsers: async () => ({ data: { users: [] }, error: null }) } as any, "new@example.com"), false);
});

test("signup API validates, exposes only existence, fails closed, and rate limits", async (t) => {
  // The shared budget as before issue #320 (per-visitor switch off)
  withSwitch(t, "false");
  let calls = 0;
  let fail = false;
  const app = express();
  app.use(express.json());
  app.use("/signup", createSignupRouter(() => ({ async listUsers() {
    calls++;
    if (fail) throw new Error("private upstream failure");
    return { data: { users: [{ email: "existing@example.com", id: "private-id" }] }, error: null };
  } } as any)));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/signup/check-email`;
  const send = (email: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
  assert.equal((await send("bad")).status, 400);
  assert.equal(calls, 0);
  const existing = await send(" Existing@example.com ");
  assert.equal(existing.headers.get("cache-control"), "no-store");
  assert.deepEqual(await existing.json(), { exists: true });
  assert.deepEqual(await (await send("new@example.com")).json(), { exists: false });
  fail = true;
  const failed = await send("new@example.com");
  assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes("private upstream"), false);
  for (let i = 0; i < 56; i++) await send("bad");
  assert.equal((await send("new@example.com")).status, 429);
  assert.equal(calls, 3);
});

test("switch off: the shared limit answers as before, without a code (issue #320)", async (t) => {
  withSwitch(t, "false");
  const { send } = await startSignupServer(t);
  for (let i = 0; i < 60; i++) await send("bad", "198.51.100.7");
  const limited = await send("new@example.com", "198.51.100.7");
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: "Too many signup checks. Please try again later." });
});

test("each visitor gets 20 checks before the shared 60, and limit answers say rate_limited (issue #320)", async (t) => {
  withSwitch(t, undefined);
  const { send, calls } = await startSignupServer(t);
  for (let i = 0; i < 20; i++) assert.equal((await send("bad", "198.51.100.1")).status, 400);
  const limited = await send("new@example.com", "198.51.100.1");
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: "Too many signup checks. Please try again later.", code: "rate_limited" });
  // Made-up earlier entries don't help: only the last one (added by Railway's edge) counts
  assert.equal((await send("new@example.com", "203.0.113.9, 198.51.100.1")).status, 429);
  // Another visitor still gets answers
  assert.deepEqual(await (await send("existing@example.com", "198.51.100.2")).json(), { exists: true });
  assert.equal(calls(), 1);
  // Requests refused by a visitor's own limit don't use up the shared budget: 21 counted so far
  for (let i = 0; i < 39; i++) assert.equal((await send("bad", `198.51.100.${10 + (i % 3)}`)).status, 400);
  const shared = await send("new@example.com", "198.51.100.50");
  assert.equal(shared.status, 429);
  assert.equal((await shared.json()).code, "rate_limited");
});

test("visitor key: last X-Forwarded-For entry, else the connection; IPv6 grouped by /56", () => {
  assert.equal(signupVisitorKey("203.0.113.9, 198.51.100.1", "10.0.0.1"), "198.51.100.1");
  assert.equal(signupVisitorKey(["203.0.113.9", "198.51.100.1 "], undefined), "198.51.100.1");
  assert.equal(signupVisitorKey(undefined, "::ffff:192.0.2.5"), "192.0.2.5");
  assert.equal(signupVisitorKey("2001:db8:abcd:12:1:2:3:4", undefined), "2001:db8:abcd::/56");
  assert.equal(signupVisitorKey("", undefined), "unknown");
});
