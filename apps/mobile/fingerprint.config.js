// An over-the-air update only reaches builds with the same fingerprint (runtimeVersion in app.json, issue #188).
// The version and build number change without any native change, and EAS raises the build number on every
// production build, so they stay out of it. The second entry keeps the library's default.
module.exports = {
  sourceSkips: ['ExpoConfigVersions', 'PackageJsonAndroidAndIosScriptsIfNotContainRun'],
};
