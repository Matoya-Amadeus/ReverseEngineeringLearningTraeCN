import fs from 'node:fs';
import path from 'node:path';
import { AuthError } from '../errors/auth-error';

export class JsonFileStore<T extends object> {
  constructor(private readonly filePath: string) {}

  read(): T | undefined {
    if (!fs.existsSync(this.filePath)) return undefined;
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as T;
    } catch (e) {
      throw new AuthError({
        code: 'STORAGE_CORRUPTED',
        message: `invalid json file: ${this.filePath}`,
        retryable: false,
        details: e
      });
    }
  }

  write(data: T): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }

  clear(): void {
    if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
  }
}
