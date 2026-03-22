import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

export const config = {
  apiBaseUrl: extra.apiBaseUrl ?? 'https://vneclassno-api.onrender.com',
};
