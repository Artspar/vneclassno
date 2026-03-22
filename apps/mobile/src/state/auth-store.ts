import { create } from 'zustand';

type AuthState = {
  accessToken?: string;
  setAccessToken: (value?: string) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: undefined,
  setAccessToken: (value) => set({ accessToken: value }),
}));
