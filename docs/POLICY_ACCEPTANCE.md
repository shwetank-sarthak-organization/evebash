# Policy acceptance rollout

This change covers web and native email/phone signup, Google/Apple onboarding, and existing authenticated accounts without acceptance. Signup requires an unchecked checkbox. The pending local intent is scoped to email and policy version and is submitted only after authentication. If confirmation happens on another browser/device, the acceptance screen is shown again. Local storage and Auth user metadata are never the acceptance record.

Authenticated clients call two Supabase RPCs. The database derives the user ID from `auth.uid()`, assigns the timestamp, validates the current policy version and explicit acceptance, and inserts an immutable record. Retries do not replace the first timestamp or platform. Direct client table writes are denied. Account deletion cascades to these records.

## Deployment order

1. Apply `supabase/migrations/20261004000000_policy_acceptance.sql` to the Supabase project used by the target frontend. Check the project before applying: staging and production may share a database.
2. Deploy the web changes and distribute the mobile build. The API backend does not need a new endpoint for this feature.
3. Verify new email/phone signup, new Google/Apple accounts, an existing account without acceptance, and a second login after acceptance. Check a row in `public.policy_acceptances` for the correct user, platform, version and server timestamp.

Do not deploy the frontend ahead of the migration: the acceptance gate deliberately blocks access on missing/unavailable acceptance RPCs and offers retry or sign out. Legal documents and web password recovery remain accessible. This is an application onboarding gate, not a replacement for authorization/RLS on application data or separate feature-specific permissions. No live database migration was applied during implementation.

## Version updates

Version `2026-10-04.1` identifies the Terms & Conditions and Privacy Policy in `shared/legal/policies.json` (documents dated September 28, 2026). Preserve the corresponding documents in version control. To require acceptance of revised documents, add a migration updating both RPC versions and update `shared/legal/acceptance.ts` together with the documents. Coordinate web/native releases; older clients cannot accept a policy version they do not display.

Marketing and Find You consent are separate and are not enabled by accepting these policies. Refund/delivery policies remain separate purchase disclosures.

## Validation

`supabase/tests/policy_acceptance.sql` tests database identity, version checks, explicit acceptance, idempotency, cross-account isolation, anonymous denial, and immutable client access against a disposable migrated database; test data is rolled back. Backend tests cover signup intent identity/version matching. Browser checks cover unchecked defaults, modal gating, legal links, failed-save retry, account switching, sign out, and successful completion.
