import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * 跨设备根路径解析：从当前脚本路径向上查找反向框架根目录。
 */
export function resolveFrameworkRoot(metaUrl) {
  let dir = path.dirname(fileURLToPath(metaUrl));
  while (true) {
    const isRoot =
      existsSync(path.join(dir, 'src')) &&
      existsSync(path.join(dir, 'tests')) &&
      existsSync(path.join(dir, 'replay'));
    if (isRoot) return dir;

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error('无法定位反向框架根目录（缺少 src/tests/replay）');
    }
    dir = parent;
  }
}
