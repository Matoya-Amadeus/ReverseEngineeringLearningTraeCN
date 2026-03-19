export class SetupLoginStatusStore {
  private failed = '';

  markFailed(reason = '1'): void {
    this.failed = reason;
  }

  consume(): string {
    const out = this.failed;
    this.failed = '';
    return out;
  }
}
