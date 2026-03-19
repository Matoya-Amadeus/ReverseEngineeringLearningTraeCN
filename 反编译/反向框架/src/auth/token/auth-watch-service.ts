import type { UserInfo } from '../types/auth-types';

export type CheckIntervalRule =
  | number
  | [Record<string, string | number | boolean | undefined>, number];

export interface AuthWatchDeps {
  check: (user: UserInfo) => Promise<void>;
  getUser: () => UserInfo | undefined;
  getRules: () => CheckIntervalRule[];
}

function resolveInterval(user: UserInfo | undefined, rules: CheckIntervalRule[]): number {
  if (!user || !rules.length) return -1;

  const flat: Record<string, unknown> = { ...user, ...(user.account || {}) };
  for (const rule of rules) {
    if (typeof rule === 'number') return rule;

    const [conds, interval] = rule;
    const ok = Object.entries(conds).every(([k, v]) => flat[k] === v);
    if (ok) return interval;
  }

  return -1;
}

export class AuthWatchService {
  private timer?: ReturnType<typeof setInterval>;
  private currentUser?: UserInfo;
  private currentRules: CheckIntervalRule[] = [];
  private currentInterval = -1;
  private firstTick = true;
  private inFlight = false;

  constructor(private readonly deps: AuthWatchDeps) {
    this.currentUser = deps.getUser();
    this.currentRules = deps.getRules();
  }

  start(): void {
    this.reconcile();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  updateUser(user: UserInfo | undefined): void {
    this.currentUser = user;
    this.reconcile();
  }

  updateRules(rules: CheckIntervalRule[]): void {
    this.currentRules = rules;
    this.reconcile();
  }

  reconcile(): void {
    const user = this.currentUser ?? this.deps.getUser();
    const rules = this.currentRules.length ? this.currentRules : this.deps.getRules();
    const interval = resolveInterval(user, rules);
    const shouldRun = !!user && interval > 0;

    if (!shouldRun) {
      this.currentInterval = -1;
      this.stop();
      return;
    }

    if (this.timer && this.currentInterval === interval) return;

    this.stop();
    this.currentInterval = interval;
    this.firstTick = true;

    this.timer = setInterval(() => {
      void this.onTick();
    }, interval);
  }

  private async onTick(): Promise<void> {
    const user = this.currentUser ?? this.deps.getUser();
    if (!user) return;

    // Match original behavior: skip first scheduled tick after timer setup.
    if (this.firstTick) {
      this.firstTick = false;
      return;
    }

    if (this.inFlight) return;
    this.inFlight = true;

    try {
      await this.deps.check(user);
    } finally {
      this.inFlight = false;
    }
  }
}
