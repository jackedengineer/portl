import type { ExpoConfig } from 'expo/config';
const production = process.env.EAS_BUILD_PROFILE === 'production';
if (
  production &&
  (!process.env.EXPO_PUBLIC_API_URL?.startsWith('https://') ||
    !process.env.EXPO_PUBLIC_OPERATOR_NAME ||
    !process.env.EXPO_PUBLIC_PRIVACY_EMAIL ||
    !process.env.EXPO_PUBLIC_EAS_PROJECT_ID)
)
  throw new Error(
    'Production requires HTTPS API URL, operator identity, privacy contact and EAS project ID.',
  );
const config: ExpoConfig = {
  name: 'Portl',
  slug: 'portl',
  scheme: 'portl',
  version: '0.1.0',
  orientation: 'default',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  backgroundColor: '#F4EDE2',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.portl.community',
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyCollectedDataTypes: [
        'Name',
        'EmailAddress',
        'UserID',
        'OtherUserContent',
        'ProductInteraction',
      ].map((type) => ({
        NSPrivacyCollectedDataType: `NSPrivacyCollectedDataType${type}`,
        NSPrivacyCollectedDataTypeLinked: true,
        NSPrivacyCollectedDataTypeTracking: false,
        NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
      })),
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
    },
  },
  android: {
    package: 'app.portl.community',
    permissions: ['POST_NOTIFICATIONS'],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#214E41' },
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro', output: 'single' },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    ['expo-notifications', { color: '#214E41', defaultChannel: 'gate' }],
  ],
  extra: {
    ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID
      ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } }
      : {}),
  },
};
export default config;
