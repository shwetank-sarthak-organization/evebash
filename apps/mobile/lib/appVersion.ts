import Constants from 'expo-constants';

/** The app version from app.json (expo.version), so the UI never shows a stale hardcoded number. */
export const APP_VERSION = Constants.expoConfig?.version ?? '';
