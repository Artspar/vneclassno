import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { MeContextResponse } from '@/lib/types';

const ACCESS_TOKEN_KEY = 'vneclassno_mobile_access_token';
const REFRESH_TOKEN_KEY = 'vneclassno_mobile_refresh_token';

type AuthState = {
  accessToken?: string;
  refreshToken?: string;
  context?: MeContextResponse;
  hydrated: boolean;
  setSession: (input: { accessToken: string; refreshToken: string }) => Promise<void>;
  clearSession: () => Promise<void>;
  setContext: (context?: MeContextResponse) => void;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: undefined,
  refreshToken: undefined,
  context: undefined,
  hydrated: false,

  setSession: async ({ accessToken, refreshToken }) => {
    set({ accessToken, refreshToken });
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  },

  clearSession: async () => {
    set({ accessToken: undefined, refreshToken: undefined, context: undefined });
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },

  setContext: (context) => set({ context }),

  hydrate: async () => {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    ]);

    set({
      accessToken: accessToken ?? undefined,
      refreshToken: refreshToken ?? undefined,
      hydrated: true,
    });
  },
}));
