import fs from 'node:fs';
import path from 'node:path';

export class FileTokenStore {
  constructor(private readonly filePath: string) {}

  write(token: string): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, token, { mode: 0o600 });
  }

  clear(): void {
    if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
  }

  exists(): boolean {
    return fs.existsSync(this.filePath);
  }
}
