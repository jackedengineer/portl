import type { Role, VisitAction, VisitStatus } from '@portl/contracts';

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function requireRole(role: Role, allowed: Role[]) {
  if (!allowed.includes(role))
    throw new DomainError('FORBIDDEN', 'Your current role cannot perform this action.', 403);
}

const transitions: Record<VisitAction, { from: VisitStatus; to: VisitStatus; roles: Role[] }> = {
  approve: { from: 'requested', to: 'approved', roles: ['resident'] },
  reject: { from: 'requested', to: 'rejected', roles: ['resident'] },
  enter: { from: 'approved', to: 'entered', roles: ['guard'] },
  exit: { from: 'entered', to: 'exited', roles: ['guard'] },
  revoke: { from: 'approved', to: 'revoked', roles: ['resident', 'admin'] },
};

export function transitionVisit(
  status: VisitStatus,
  action: VisitAction,
  role: Role,
  expiresAt: Date,
  now = new Date(),
): VisitStatus {
  const rule = transitions[action];
  requireRole(role, rule.roles);
  if (status !== rule.from)
    throw new DomainError(
      'VISIT_CHANGED',
      'This visit has already changed. Refresh to see its current status.',
      409,
    );
  if (['approve', 'enter'].includes(action) && expiresAt <= now)
    throw new DomainError(
      'VISIT_EXPIRED',
      'This approval has expired. Please request a new approval.',
      409,
    );
  return rule.to;
}

export function checkPassWindow(validFrom: Date, validUntil: Date, now = new Date()) {
  if (validFrom > now || validUntil <= now)
    throw new DomainError(
      'PASS_NOT_VALID',
      'This guest pass is outside its valid time window.',
      409,
    );
}

export function assertBookingAvailable(
  capacity: number,
  reserved: number,
  startsAt: Date,
  now = new Date(),
) {
  if (startsAt <= now)
    throw new DomainError(
      'SLOT_STARTED',
      'This slot has already started. Please choose another.',
      409,
    );
  if (reserved >= capacity)
    throw new DomainError('SLOT_FULL', 'That slot just filled up. Please choose another.', 409);
}

export function assertOwnFlat(role: Role, flatIds: string[], flatId: string) {
  if (role === 'resident' && !flatIds.includes(flatId))
    throw new DomainError(
      'FORBIDDEN',
      'This flat is outside your active household membership.',
      403,
    );
}
