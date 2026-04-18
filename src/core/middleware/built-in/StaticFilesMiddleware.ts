import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

import type { Middleware, Next } from '../types.js';
import type { Request } from '../../http/Request.js';
import type { Response } from '../../http/Response.js';
import { resolveStaticFilePath } from '../../utils/fs.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * Отдаёт статические файлы из указанной директории.
 *
 * Поддерживает условные запросы через ETag (If-None-Match → 304 Not Modified).
 * Защищена от path-traversal атак: файлы за пределами корневой директории
 * не возвращаются (см. resolveStaticFilePath).
 */
export class StaticFilesMiddleware implements Middleware {
  readonly name = 'StaticFilesMiddleware';

  private readonly resolvedRoot: string;

  constructor(
    root: string,
    private readonly prefix = '/static',
  ) {
    this.resolvedRoot = resolve(root);
  }

  async handle(req: Request, res: Response, next: Next): Promise<void> {
    if (!req.pathname.startsWith(this.prefix)) {
      return next();
    }

    const filePath = resolveStaticFilePath(
      this.resolvedRoot,
      req.pathname.slice(this.prefix.length),
    );

    if (!filePath) {
      return next();
    }

    let fileStat;

    try {
      fileStat = await stat(filePath);
    } catch {
      return next();
    }

    if (!fileStat.isFile()) {
      return next();
    }

    const etag = `"${fileStat.size}-${fileStat.mtimeMs}"`;

    if (req.headers['if-none-match'] === etag) {
      res.status(304).send('');
      return;
    }

    const mimeType = MIME_TYPES[extname(filePath)] ?? 'application/octet-stream';

    res.status(200);
    res.header('ETag', etag);
    res.header('Content-Type', mimeType);
    res.header('Content-Length', String(fileStat.size));

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filePath);
      stream.pipe(res.raw, { end: true });
      stream.on('error', reject);
      res.raw.on('error', reject);
      res.raw.on('finish', resolve);
    });
  }
}
