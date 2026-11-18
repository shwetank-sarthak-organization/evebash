// Gives the staging app its own identity so it can sit next to the live app on one phone and staging links
// never open the live app (todo #30). app.json holds the shared settings and the production identity.
// APP_VARIANT comes from the eas.json build profile. Not set (local USB builds, Metro) means staging, so a
// mistake can never make a build that looks like the live app.
const VARIANTS = ['staging', 'production'];
const GOOGLE_SIGNIN_PLUGIN = '@react-native-google-signin/google-signin';
const GOOGLE_IOS_CLIENT_ID_SUFFIX = '.apps.googleusercontent.com';

// The iPhone staging app's bundle ID is com.evebash.staging, not com.evebash.app.staging like Android: that one is
// held by a free Apple account (Xcode USB build, 2026-11-16) and Apple IDs can't be moved between teams (#286).
const STAGING_IOS_BUNDLE_ID = 'com.evebash.staging';

// The staging app has its own Google iOS client (bundle ID com.evebash.staging). Google's URL scheme is the
// client ID reversed, so it follows EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (eas.json staging profile, apps/mobile/.env.local).
const withStagingGoogleIosScheme = (plugins = []) => {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!clientId?.endsWith(GOOGLE_IOS_CLIENT_ID_SUFFIX)) return plugins;
  const iosUrlScheme = `com.googleusercontent.apps.${clientId.slice(0, -GOOGLE_IOS_CLIENT_ID_SUFFIX.length)}`;
  return plugins.map((entry) =>
    Array.isArray(entry) && entry[0] === GOOGLE_SIGNIN_PLUGIN ? [entry[0], { ...entry[1], iosUrlScheme }] : entry,
  );
};

module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT || 'staging';
  if (!VARIANTS.includes(variant)) {
    throw new Error(`APP_VARIANT must be one of ${VARIANTS.join(', ')}, got "${variant}"`);
  }
  if (variant === 'production') return config;
  return {
    ...config,
    name: 'EveBash Staging',
    scheme: 'evebash-staging',
    ios: { ...config.ios, bundleIdentifier: STAGING_IOS_BUNDLE_ID },
    android: { ...config.android, package: 'com.evebash.app.staging' },
    plugins: withStagingGoogleIosScheme(config.plugins),
  };
};
