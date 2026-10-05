import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdminClient } from "../supabase.js";

export const VENDOR_CATEGORIES = [
  "Photographer",
  "Videographer",
  "Decorator",
  "Caterer",
  "Venue",
  "Makeup Artist",
  "DJ / Music",
  "Event Planner",
  "Other",
] as const;

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

const required = (maxLength: number) =>
  z.preprocess((value) => cleanText(value, maxLength), z.string().min(1, "Please fill in all required fields."));

const optional = (maxLength: number) =>
  z.preprocess((value) => cleanText(value, maxLength) || null, z.string().nullable());

export const vendorLeadSchema = z.object({
  businessName: required(120),
  contactName: required(80),
  category: z.enum(VENDOR_CATEGORIES, { error: "Please choose a category." }),
  city: required(80),
  phone: z.preprocess(
    (value) => cleanText(value, 20),
    z.string().regex(/^\+?[0-9\s-]{7,20}$/, "Please enter a valid phone number."),
  ),
  email: z.preprocess(
    (value) => cleanText(value, 160).toLowerCase() || null,
    z.string().email("Please enter a valid email address.").nullable(),
  ),
  website: optional(200),
  notes: optional(2000),
  source: z.enum(["web", "mobile"]).default("mobile").catch("mobile"),
});

type VendorLeadInsert = (row: Record<string, unknown>) => Promise<{ error: unknown }>;

const insertWithSupabase: VendorLeadInsert = async (row) =>
  getSupabaseAdminClient().from("vendor_leads").insert(row);

export function createVendorLeadsRouter(insert: VendorLeadInsert = insertWithSupabase) {
  const router = Router();

  router.post("/", async (request, response) => {
    try {
      const parsed = vendorLeadSchema.safeParse(request.body || {});
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        return response.status(400).json({ success: false, error: firstIssue?.message || "Invalid request body." });
      }

      const { businessName, contactName, category, city, phone, email, website, notes, source } = parsed.data;

      const { error } = await insert({
        business_name: businessName,
        contact_name: contactName,
        category,
        city,
        phone,
        email,
        website,
        notes,
        source,
        user_agent: request.get("user-agent") || "",
      });

      if (error) {
        request.log?.error({ error }, "[BackendVendorLeads] Insert failed");
        return response.status(500).json({ success: false, error: "Unable to submit right now." });
      }

      return response.json({ success: true });
    } catch (error) {
      request.log?.error({ error }, "[BackendVendorLeads] Request failed");
      return response.status(500).json({ success: false, error: "Unable to submit right now." });
    }
  });

  return router;
}
