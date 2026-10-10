import { Platform } from 'react-native';
import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { apiUrl } from './state';

export const authClient = createAuthClient({
  baseURL: apiUrl || 'http://localhost:4000',
  plugins: [
    emailOTPClient(),
    ...(Platform.OS === 'web'
      ? []
      : [expoClient({ scheme: 'portl', storagePrefix: 'portl', storage: SecureStore })]),
  ],
});
