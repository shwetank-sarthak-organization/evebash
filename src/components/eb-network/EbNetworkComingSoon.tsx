"use client";

import { FormEvent, useState } from "react";
import { BadgeCheck, CheckCircle2, Heart, Images, MapPin, Search, Send, Sparkles, Star, Store, Users } from "lucide-react";
import { getApiUrl } from "@/lib/apiBase";

// Shared EB Network wording. The app's EB Network tab (apps/mobile/app/(tabs)/vendors.tsx) uses the same text: keep them in sync.
const TAGLINE = "Find trusted event vendors, all in one place.";
const INTRO =
  "Any EveBash user can set up a business with EB Business, whether they're a photographer, venue, caterer or decorator. Those businesses will be listed on EB Network, where hosts can discover, compare and shortlist them for their events.";

const STEPS = [
  { title: "Create your business", text: "Set up your profile, services and portfolio in EB Business." },
  { title: "Get listed on EB Network", text: "Publish your business so hosts can find it." },
  { title: "Hosts find you", text: "Hosts search, compare and shortlist vendors for their events." },
];

const PERKS = [
  { icon: Users, title: "Get discovered by hosts", text: "Reach hosts planning weddings, parties and celebrations." },
  { icon: Images, title: "Showcase your work", text: "Build a portfolio straight from the events you cover on EveBash." },
  { icon: BadgeCheck, title: "Early partner perks", text: "Businesses that register now get priority listing at launch." },
];

// Must match VENDOR_CATEGORIES in apps/backend/src/routes/vendorLeads.ts.
const CATEGORIES = [
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

const EMPTY_FORM = { businessName: "", contactName: "", city: "", phone: "", email: "", website: "", notes: "" };
type FormField = keyof typeof EMPTY_FORM;

const inputClass =
  "w-full px-4 py-3 bg-[var(--site-input)] border border-[var(--site-border)] rounded-lg text-[var(--site-text)] placeholder:text-[var(--site-muted)] focus:outline-none focus:border-[#CA9C68] focus:ring-4 focus:ring-[#CA9C68]/10 transition-all";
const labelClass = "block text-xs font-bold text-[var(--site-subtle)] uppercase tracking-wider mb-2";

export default function EbNetworkComingSoon() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const updateField = (field: FormField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSubmitError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!category) {
      setSubmitError("Please choose a category.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch(getApiUrl("/api/v1/vendor-leads"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, category, source: "web" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to submit right now.");
      }
      setForm(EMPTY_FORM);
      setCategory("");
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit right now.");
    } finally {
      setSubmitting(false);
    }
  };

  const textInput = (field: FormField, label: string, placeholder: string, options: { type?: string; required?: boolean } = {}) => (
    <div>
      <label htmlFor={`eb-network-${field}`} className={labelClass}>
        {label}
        {options.required ? " *" : ""}
      </label>
      <input
        id={`eb-network-${field}`}
        type={options.type ?? "text"}
        required={options.required}
        value={form[field]}
        onChange={(event) => updateField(field, event.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );

  return (
    <main className="min-h-screen bg-[var(--site-bg)] px-4 py-24 text-[var(--site-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-20">
        <section className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#CA9C68]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#CA9C68]">
            <Sparkles className="h-4 w-4" />
            Coming soon
          </div>
          <h1 className="font-serif text-5xl text-[var(--site-text)] sm:text-6xl">EB Network</h1>
          <p className="mt-4 text-xl text-[#CA9C68] sm:text-2xl">{TAGLINE}</p>
          <p className="mt-6 text-base leading-8 text-[var(--site-subtle)] sm:text-lg">{INTRO}</p>
          <a
            href="#list-your-business"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#CA9C68] px-6 py-3 font-bold text-[#13191F] transition-colors hover:bg-[#D9AE7E]"
          >
            <Store className="h-5 w-5" />
            List your business
          </a>
        </section>

        <section aria-labelledby="eb-network-how">
          <h2 id="eb-network-how" className="mb-8 text-center font-serif text-3xl">How it works</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-card)] p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#CA9C68]/15 font-bold text-[#CA9C68]">{index + 1}</span>
                <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--site-muted)]">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="eb-network-preview">
          <div className="mb-8 text-center">
            <h2 id="eb-network-preview" className="font-serif text-3xl">A first look</h2>
            <p className="mt-2 text-sm text-[var(--site-muted)]">A preview of what hosts will see at launch. Listings will appear here once EB Network opens.</p>
          </div>
          <DirectoryPreview />
        </section>

        <section aria-labelledby="eb-network-perks">
          <h2 id="eb-network-perks" className="mb-8 text-center font-serif text-3xl">Why list your business</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {PERKS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-card)] p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#CA9C68]/10 text-[#CA9C68]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--site-muted)]">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="list-your-business" className="mx-auto max-w-3xl scroll-mt-24 rounded-2xl border border-[var(--site-border)] bg-[var(--site-card)] p-6 shadow-xl sm:p-10">
          {submitted ? (
            <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-[#CA9C68]" />
              <h2 className="font-serif text-3xl">You&apos;re on the list</h2>
              <p className="text-[var(--site-muted)]">Thanks for registering. Our team will contact you soon.</p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-2 rounded-lg border border-[var(--site-border)] px-5 py-3 font-bold text-[var(--site-text)] transition-colors hover:border-[#CA9C68]"
              >
                Register another business
              </button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <h2 className="font-serif text-3xl">List your business</h2>
                <p className="mt-2 text-sm text-[var(--site-muted)]">
                  Register your interest and we&apos;ll contact you before launch. Fields marked * are required.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {textInput("businessName", "Business name", "Pixel Stories Studio", { required: true })}
                {textInput("contactName", "Your name", "Your full name", { required: true })}
              </div>

              <fieldset>
                <legend className={labelClass}>Category *</legend>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((item) => {
                    const selected = item === category;
                    return (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setCategory(item);
                          setSubmitError("");
                        }}
                        className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                          selected
                            ? "border-[#CA9C68] bg-[#CA9C68]/15 font-semibold text-[#CA9C68]"
                            : "border-[var(--site-border)] text-[var(--site-muted)] hover:border-[#CA9C68]/60"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-6 md:grid-cols-2">
                {textInput("city", "City", "Dehradun", { required: true })}
                {textInput("phone", "Phone", "+91 98765 43210", { type: "tel", required: true })}
                {textInput("email", "Email", "you@example.com", { type: "email" })}
                {textInput("website", "Instagram / website", "@yourstudio")}
              </div>

              <div>
                <label htmlFor="eb-network-notes" className={labelClass}>Anything else?</label>
                <textarea
                  id="eb-network-notes"
                  rows={4}
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  placeholder="Services, price range, cities you cover..."
                  className={inputClass}
                />
              </div>

              {submitError && (
                <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-900/30 px-4 py-3 text-sm font-medium text-rose-300">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#CA9C68] py-4 font-bold text-[#13191F] shadow-lg transition-colors hover:bg-[#D9AE7E] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Registering..." : "Register interest"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

const PREVIEW_CHIPS = ["All", "Photographers", "Venues", "Caterers", "Decorators", "Makeup Artists", "DJ & Music", "Event Planners"];

/** A non-interactive sketch of the directory: placeholder cards only, no made-up vendors. */
function DirectoryPreview() {
  return (
    <div aria-hidden="true" className="relative select-none overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 sm:p-6">
      <span className="absolute right-4 top-4 rounded-full bg-[#CA9C68] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#13191F]">Preview</span>
      <div className="flex max-w-xl items-center gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-input)] px-4 py-3 text-sm text-[var(--site-muted)]">
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search photographers, venues, caterers...</span>
      </div>
      <div className="mt-4 flex gap-2 overflow-hidden">
        {PREVIEW_CHIPS.map((chip, index) => (
          <span
            key={chip}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
              index === 0 ? "border-[#CA9C68] bg-[#CA9C68]/15 text-[#CA9C68]" : "border-[var(--site-border)] text-[var(--site-muted)]"
            }`}
          >
            {chip}
          </span>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((card) => (
          <div key={card} className={`overflow-hidden rounded-xl border border-[var(--site-border)] bg-[var(--site-card)] ${card === 2 ? "hidden lg:block" : card === 1 ? "hidden sm:block" : ""}`}>
            <div className="relative h-32 bg-[#CA9C68]/10">
              <Heart className="absolute right-3 top-3 h-5 w-5 text-[var(--site-muted)]" />
            </div>
            <div className="space-y-3 p-4">
              <div className="h-4 w-2/3 rounded bg-[var(--site-text)]/15" />
              <div className="flex items-center gap-2 text-xs text-[var(--site-muted)]">
                <MapPin className="h-3.5 w-3.5" />
                <div className="h-3 w-1/3 rounded bg-[var(--site-muted)]/20" />
              </div>
              <div className="flex items-center gap-1 text-[#CA9C68]">
                {[0, 1, 2, 3, 4].map((star) => (
                  <Star key={star} className="h-3.5 w-3.5" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--site-surface)] to-transparent" />
    </div>
  );
}
