// iOS (#276): what Xcode 27 / the iOS 27 SDK needs from the generated ios folder, so `expo prebuild --clean` and
// EAS builds no longer need hand patches.
// (1) Apps built with the iOS 27 SDK must use the UIScene lifecycle, or iOS 27 closes them at launch
//     (UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption). Expo SDK 55's AppDelegate starts React Native
//     in application(_:didFinishLaunchingWithOptions:) with no scene. This adds a SceneDelegate that starts React
//     Native in scene(_:willConnectTo:options:) instead, and passes app events (active, background...), deep links
//     and universal links on to the AppDelegate, so Expo modules and React Native get them exactly as before.
//     Plus UIApplicationSceneManifest in Info.plist, which tells iOS to use it. Works on every iOS the app supports.
// (2) Xcode 27 rejects pod targets (including the resource-bundle targets React Native's own fix skips) whose
//     minimum iOS is below the app's, so the Podfile's post_install raises them to the app's minimum
//     (ios.deploymentTarget from expo-build-properties in app.json).
// Remove this plugin once an Expo SDK ships a scene-based AppDelegate.
const { withAppDelegate, withInfoPlist, withPodfile } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const SCENE_MARKER = 'class SceneDelegate: UIResponder, UIWindowSceneDelegate';

// Expo SDK 55's AppDelegate.swift start-up block. If an SDK upgrade changes it, the build stops here on purpose.
const START_IN_APP_DELEGATE = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif`;

const START_MOVED_NOTE =
  '    // React Native starts in SceneDelegate (iOS 27 scene lifecycle, plugins/withIosXcode27.js, #276).';

const SCENE_DELEGATE = `
// iOS 27 SDK: apps must use the UIScene lifecycle (plugins/withIosXcode27.js, #276). React Native starts here, and
// app events, deep links and universal links go on to the AppDelegate, so Expo modules and React Native see them as
// they did before scenes.
${SCENE_MARKER} {
  var window: UIWindow?

  private var appDelegate: AppDelegate? { UIApplication.shared.delegate as? AppDelegate }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = appDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    // With scenes, a link that opened the app arrives here, not in the AppDelegate's launch options. React Native's
    // Linking.getInitialURL() reads the launch options, so rebuild them.
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let urlContext = connectionOptions.urlContexts.first {
      launchOptions[.url] = urlContext.url
      if let source = urlContext.options.sourceApplication {
        launchOptions[.sourceApplication] = source
      }
    }
    if let userActivity = connectionOptions.userActivities.first(where: { $0.activityType == NSUserActivityTypeBrowsingWeb }) {
      launchOptions[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType.rawValue: userActivity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": userActivity,
      ]
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions.isEmpty ? nil : launchOptions)

    // Without scenes iOS also called application(_:open:) / application(_:continue:) for the link that opened the
    // app (expo-linking keeps it as the initial URL), so do the same.
    if !connectionOptions.urlContexts.isEmpty {
      self.scene(scene, openURLContexts: connectionOptions.urlContexts)
    }
    for userActivity in connectionOptions.userActivities {
      self.scene(scene, continue: userActivity)
    }
  }

  // Linking API
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = appDelegate else { return }
    for context in URLContexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [.openInPlace: context.options.openInPlace]
      if let source = context.options.sourceApplication {
        options[.sourceApplication] = source
      }
      if let annotation = context.options.annotation {
        options[.annotation] = annotation
      }
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: options)
    }
  }

  // Universal Links
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }

  // App events, which iOS sends to the scene instead of the AppDelegate once scenes are on
  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }
}
`;

const POD_TARGETS = `    # Xcode 27 rejects pod targets (resource bundles too) below the app's minimum iOS (plugins/withIosXcode27.js, #276)
    eb_min_ios = podfile_properties['ios.deploymentTarget'] || '15.1'
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current && Gem::Version.new(current) < Gem::Version.new(eb_min_ios)
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = eb_min_ios
        end
      end
    end`;

const withSceneDelegate = (config) =>
  withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withIosXcode27: expected a Swift AppDelegate');
    }
    let contents = cfg.modResults.contents;
    if (contents.includes(SCENE_MARKER)) return cfg;
    if (!contents.includes(START_IN_APP_DELEGATE)) {
      throw new Error(
        'withIosXcode27: the AppDelegate start-up block changed (Expo SDK upgrade?). Check whether the new SDK ' +
          'supports the UIScene lifecycle itself, then update or remove plugins/withIosXcode27.js (#276).',
      );
    }
    contents = contents.replace(START_IN_APP_DELEGATE, START_MOVED_NOTE);
    cfg.modResults.contents = `${contents.trimEnd()}\n${SCENE_DELEGATE}`;
    return cfg;
  });

const withSceneManifest = (config) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

const withPodMinimumIos = (config) =>
  withPodfile(config, (cfg) => {
    const result = mergeContents({
      tag: 'evebash-xcode27-pod-targets',
      src: cfg.modResults.contents,
      newSrc: POD_TARGETS,
      anchor: /:ccache_enabled => ccache_enabled\?\(podfile_properties\),/,
      offset: 2,
      comment: '#',
    });
    if (!result.didMerge && !result.didClear && !cfg.modResults.contents.includes('evebash-xcode27-pod-targets')) {
      throw new Error('withIosXcode27: could not find react_native_post_install in the Podfile (#276)');
    }
    cfg.modResults.contents = result.contents;
    return cfg;
  });

module.exports = function withIosXcode27(config) {
  return withPodMinimumIos(withSceneManifest(withSceneDelegate(config)));
};
