const path = require('node:path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

// Expo's default config plus debug ids, which match Sentry errors to their uploaded source maps
const config = getSentryExpoConfig(projectRoot);
// The website and native apps bundle the same policy content.
config.watchFolders = [...new Set([
  ...(config.watchFolders || []),
  monorepoRoot,
  path.resolve(monorepoRoot, 'shared'),
])];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@shared/legal': path.resolve(monorepoRoot, 'shared/legal'),
};

// Issue #330: expo-symbols' SymbolView imports useFonts from the root of @expo-google-fonts/material-symbols, and that
// root file require()s all 7 Material Symbols weights (~6.7 MB). expo-symbols only ever loads the Regular weight (its
// android/weights/regular file imports that one face directly), so point the root import at the package's own useFonts
// file. Same function, nothing else changes; the 6 unused weights just stop being bundled.
const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const target = moduleName === '@expo-google-fonts/material-symbols'
    ? '@expo-google-fonts/material-symbols/useFonts'
    : moduleName;
  return previousResolveRequest
    ? previousResolveRequest(context, target, platform)
    : context.resolveRequest(context, target, platform);
};

module.exports = config;
