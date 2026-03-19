import { appendFileSync } from 'node:fs';
import type { ProtocolProvider } from './protocol-requester';

export interface RequestFingerprint {
  ts: string;
  provider: ProtocolProvider;
  path: string;
  method: 'GET' | 'POST';
  hasToken: boolean;
  requestId?: string;
  traceId?: string;
  dataKeys: string[];
  headerKeys: string[];
  missingDataKeys: string[];
  missingHeaderKeys: string[];
}

export class RequestFingerprintRecorder {
  private readonly records: RequestFingerprint[] = [];

  constructor(private readonly outFile?: string) {}

  record(item: RequestFingerprint): void {
    this.records.push(item);
    if (this.records.length > 500) {
      this.records.splice(0, this.records.length - 500);
    }

    if (this.outFile) {
      appendFileSync(this.outFile, JSON.stringify(item) + '\n', 'utf8');
    }
  }

  snapshot(): RequestFingerprint[] {
    return this.records.map((x) => ({ ...x, dataKeys: [...x.dataKeys], headerKeys: [...x.headerKeys] }));
  }
}
