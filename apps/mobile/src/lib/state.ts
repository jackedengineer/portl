import { create } from 'zustand';
import type { Profile, Role } from '@portl/contracts';
import { demoSocietyId } from '@portl/domain/demo';

export const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
interface AppState {
  mode: 'demo' | 'live';
  role: Role;
  societyId: string;
  profile: Profile | null;
  pushToken: string | null;
  setContext: (societyId: string, role: Role) => void;
  enterDemo: (role?: Role) => void;
  setProfile: (profile: Profile) => void;
  leave: () => void;
}
export const useAppStore = create<AppState>((set) => ({
  mode: apiUrl ? 'live' : 'demo',
  role: 'resident',
  societyId: apiUrl ? '' : demoSocietyId,
  profile: null,
  pushToken: null,
  setContext: (societyId, role) => set({ societyId, role }),
  enterDemo: (role = 'resident') =>
    set({ mode: 'demo', role, societyId: demoSocietyId, profile: null }),
  setProfile: (profile) =>
    set((state) => {
      const membership =
        profile.memberships.find((m) => m.society.id === state.societyId) ?? profile.memberships[0];
      return {
        mode: 'live',
        profile,
        societyId: membership?.society.id ?? '',
        role: membership?.roles.includes(state.role)
          ? state.role
          : (membership?.roles[0] ?? 'resident'),
      };
    }),
  leave: () =>
    set({ mode: 'live', profile: null, societyId: '', role: 'resident', pushToken: null }),
}));

interface ToastState {
  message: string;
  kind: 'success' | 'error';
  show: (message: string, kind?: 'success' | 'error') => void;
  clear: () => void;
}
export const useToast = create<ToastState>((set) => ({
  message: '',
  kind: 'success',
  show: (message, kind = 'success') => set({ message, kind }),
  clear: () => set({ message: '' }),
}));
