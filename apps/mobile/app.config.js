// Gives the staging app its own identity so it can sit next to the live app on one phone and staging links
// never open the live app (todo #30). app.json holds the shared settings and the production identity.
// APP_VARIANT comes from the eas.json build profile. Not set (local USB builds, Metro) means staging, so a
// mistake can never make a build that looks like the live app.
const VARIANTS = ['staging', 'production'];

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
    ios: { ...config.ios, bundleIdentifier: 'com.evebash.app.staging' },
    android: { ...config.android, package: 'com.evebash.app.staging' },
  };
};
