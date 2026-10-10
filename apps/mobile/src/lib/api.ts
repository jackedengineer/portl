import { Platform } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiErrorBody, Overview, Profile } from '@portl/contracts';
import { authClient } from './auth';
import { apiUrl, useAppStore } from './state';
import { demoCommand, demoOverview } from './demo';
import type { Command, CommandResult } from './commands';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function apiRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (!apiUrl)
    throw new ApiError(
      'Sign-in is available when a Portl server is connected. You can explore the demo now.',
      503,
    );
  const { role } = useAppStore.getState();
  const cookie = Platform.OS === 'web' ? undefined : await authClient.getCookie();
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    credentials: Platform.OS === 'web' ? 'include' : 'omit',
    headers: {
      'Content-Type': 'application/json',
      'X-Portl-Role': role,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      data?.error?.message ?? 'We could not complete that request. Please try again.',
      response.status,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const loadProfile = () => apiRequest<Profile>('/v1/me');
function endpoint(c: Command): [string, string, unknown?] {
  switch (c.type) {
    case 'visit.create':
      return ['/visits', 'POST', c.input];
    case 'visit.action':
      return [`/visits/${c.id}/actions`, 'POST', { action: c.action }];
    case 'pass.create':
      return ['/passes', 'POST', c.input];
    case 'pass.revoke':
      return [`/passes/${c.id}/revoke`, 'POST'];
    case 'pass.redeem':
      return ['/passes/redeem', 'POST', { token: c.token }];
    case 'booking.create':
      return ['/bookings', 'POST', { slotId: c.slotId }];
    case 'booking.cancel':
      return [`/bookings/${c.id}/cancel`, 'POST'];
    case 'notice.save':
      return [`/notices${c.id ? `/${c.id}` : ''}`, c.id ? 'PATCH' : 'POST', c.input];
    case 'notice.delete':
      return [`/notices/${c.id}`, 'DELETE'];
    case 'staff.save':
      return [`/staff${c.id ? `/${c.id}` : ''}`, c.id ? 'PATCH' : 'POST', c.input];
    case 'staff.delete':
      return [`/staff/${c.id}`, 'DELETE'];
    case 'tower.create':
      return ['/towers', 'POST', { name: c.name }];
    case 'flat.create':
      return ['/flats', 'POST', { towerId: c.towerId, number: c.number }];
    case 'amenity.save':
      return [`/amenities${c.id ? `/${c.id}` : ''}`, c.id ? 'PATCH' : 'POST', c.input];
    case 'slot.create':
      return [
        `/amenities/${c.amenityId}/slots`,
        'POST',
        { startsAt: c.startsAt, endsAt: c.endsAt, capacity: c.capacity },
      ];
    case 'member.grant':
      return ['/members/grant', 'POST', { email: c.email, role: c.role }];
    case 'member.status':
      return [`/members/${c.id}`, 'PATCH', { status: c.status }];
    case 'join.decide':
      return [`/join-requests/${c.id}/decision`, 'POST', { decision: c.decision }];
    case 'notification.read':
      return ['/notifications/read', 'POST'];
    case 'invite.create':
      return ['/invitations', 'POST', { email: c.email, flatId: c.flatId }];
  }
}
export function useOverview() {
  const { mode, role, societyId } = useAppStore();
  return useQuery({
    queryKey: ['overview', mode, societyId, role],
    queryFn: () =>
      mode === 'demo'
        ? demoOverview(role)
        : apiRequest<Overview>(`/v1/societies/${societyId}/overview`),
    enabled: mode === 'demo' || !!societyId,
    staleTime: 15000,
    refetchInterval: mode === 'live' ? 20000 : false,
    retry: (count, error) =>
      !(error instanceof ApiError && [401, 403].includes(error.status)) && count < 1,
  });
}
export function useCommand() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (command: Command): Promise<CommandResult> => {
      const { mode, role, societyId } = useAppStore.getState();
      if (mode === 'demo') return demoCommand(role, command);
      const [path, method, body] = endpoint(command);
      return (
        (await apiRequest<CommandResult>(`/v1/societies/${societyId}${path}`, method, body)) ?? {}
      );
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: ['overview'] }),
    onError: () => cache.invalidateQueries({ queryKey: ['overview'] }),
  });
}
