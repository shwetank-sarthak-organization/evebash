// Keep this version aligned with supabase/migrations/20261011000000_find_you_consent.sql when the wording changes.
export const FIND_YOU_CONSENT_VERSION = '2026-10-11.1';
export const FIND_YOU_CONSENT_TITLE = 'Before you use Find You';
export const FIND_YOU_CONSENT_POINTS = [
  'Find You turns the face in your selfie into a face template and compares it with face templates made from photos in the galleries you can open.',
  'Your selfie is used only for this search and is not stored. Face templates from gallery photos are deleted when the photo or gallery is deleted.',
  'Matches can be wrong or missed. Results are shown only to you.',
  'You can withdraw this consent at any time from Settings in the app or on the website.',
];
export const FIND_YOU_CONSENT_ADULT = 'I am 18 or older.';
export const FIND_YOU_CONSENT_AGREE = 'I agree that EveBash may process my selfie and face data for Find You as described above and in the Privacy Policy.';
// Stored with each consent record as evidence of what was agreed to.
export const FIND_YOU_CONSENT_TEXT = `${FIND_YOU_CONSENT_ADULT} ${FIND_YOU_CONSENT_AGREE}`;
export const FIND_YOU_CONSENT_REQUIRED_CODE = 'FIND_YOU_CONSENT_REQUIRED';
