const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
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
