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

module.exports = config;
