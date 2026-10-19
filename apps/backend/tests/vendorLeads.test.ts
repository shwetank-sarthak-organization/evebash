import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { createVendorLeadsRouter } from "../src/routes/vendorLeads.js";

const validLead = {
  businessName: "  Pixel Stories  ",
  contactName: "Asha",
  category: "Photographer",
  city: "Dehradun",
  phone: "+91 98765 43210",
  email: " Asha@Example.com ",
  website: "",
  notes: "Weddings and pre-wedding shoots",
  source: "mobile",
};

test("vendor leads API validates input, normalises fields, and fails closed", async (t) => {
  const rows: Record<string, unknown>[] = [];
  let fail = false;
  const app = express();
  app.use(express.json());
  app.use("/vendor-leads", createVendorLeadsRouter(async (row) => {
    if (fail) return { error: new Error("private upstream failure") };
    rows.push(row);
    return { error: null };
  }));
  const server = app.listen(0);
  t.after(() => server.close());
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/vendor-leads`;
  const post = async (body: unknown) => {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };

  assert.deepEqual(await post(validLead), { status: 200, body: { success: true } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].business_name, "Pixel Stories");
  assert.equal(rows[0].email, "asha@example.com");
  assert.equal(rows[0].website, null);
  assert.equal(rows[0].category, "Photographer");

  const missingName = await post({ ...validLead, businessName: " " });
  assert.equal(missingName.status, 400);
  assert.equal(missingName.body.error, "Please fill in all required fields.");
  assert.equal((await post({ ...validLead, category: "Astronaut" })).body.error, "Please choose a category.");
  assert.equal((await post({ ...validLead, phone: "call me" })).body.error, "Please enter a valid phone number.");
  assert.equal((await post({ ...validLead, email: "nope" })).body.error, "Please enter a valid email address.");
  assert.equal((await post({ ...validLead, email: "" })).status, 200);
  assert.equal(rows.length, 2);

  fail = true;
  assert.deepEqual(await post(validLead), { status: 500, body: { success: false, error: "Unable to submit right now." } });
});
