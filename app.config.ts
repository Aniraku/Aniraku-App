import type { ExpoConfig } from "expo/config";

const env = {
  appName: "Aniraku",
  appSlug: "aniraku",
  logoUrl: "/manus-storage/icon_cc474f8c.png",
  scheme: "aniraku",
  iosBundleId: "tech.aniraku.app",
  androidPackage: "tech.aniraku.app",
  easProjectId: "e96fc02e-d968-4f13-a688-0d553d855df7",
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    versionCode: 1,
    adaptiveIcon: { backgroundColor: "#090909", foregroundImage: "./assets/images/android-icon-foreground.png" },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS"],
    intentFilters: [{ action: "VIEW", autoVerify: true, data: [{ scheme: env.scheme, host: "auth" }], category: ["BROWSABLE", "DEFAULT"] }],
  },
  web: { bundler: "metro", output: "static", favicon: "./assets/images/favicon.png" },
  plugins: [
    "expo-router",
    ["expo-secure-store", { configureAndroidBackup: true }],
    ["expo-video", { supportsBackgroundPlayback: true, supportsPictureInPicture: true }],
    ["expo-splash-screen", { image: "./assets/images/splash-icon.png", imageWidth: 200, resizeMode: "contain", backgroundColor: "#090909", dark: { backgroundColor: "#090909" } }],
    ["expo-build-properties", { android: { buildArchs: ["armeabi-v7a", "arm64-v8a"], minSdkVersion: 24 } }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: { eas: { projectId: env.easProjectId } },
};

export default config;
