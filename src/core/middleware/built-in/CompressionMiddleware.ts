import { createGzip, createBrotliCompress, type Gzip, type BrotliCompress } from 'node:zlib';

import type { Middleware, Next } from '../types.js';
import type { Request } from '../../http/Request.js';
import type { Response } from '../../http/Response.js';

/**
 * Сжимает тело ответа с помощью Brotli или Gzip.
 *
 * Выбор алгоритма основан на заголовке Accept-Encoding:
 * Brotli предпочтительнее — он даёт лучшую степень сжатия.
 * Middleware патчит методы write/end объекта ServerResponse,
 * прозрачно пропуская данные через поток сжатия.
 */
export class CompressionMiddleware implements Middleware {
  readonly name = 'CompressionMiddleware';

  async handle(req: Request, res: Response, next: Next): Promise<void> {
    const acceptEncoding = (req.headers['accept-encoding'] as string | undefined) ?? '';

    const encoding = acceptEncoding.includes('br')
      ? 'br'
      : acceptEncoding.includes('gzip')
        ? 'gzip'
        : null;

    if (encoding) {
      this.patchResponse(res, encoding);
    }

    await next();
  }

  private patchResponse(res: Response, encoding: 'gzip' | 'br'): void {
    const stream: Gzip | BrotliCompress =
      encoding === 'br' ? createBrotliCompress() : createGzip();

    const raw = res.raw;
    raw.removeHeader('Content-Length');
    raw.setHeader('Content-Encoding', encoding);
    raw.setHeader('Vary', 'Accept-Encoding');

    stream.pipe(raw);

    type Patchable = {
      write: (chunk: Buffer, cb?: () => void) => boolean;
      end: (chunk?: Buffer, cb?: () => void) => void;
    };

    const patchable = raw as unknown as Patchable;

    patchable.write = (chunk: Buffer, cb?: () => void): boolean =>
      stream.write(chunk, cb);

    patchable.end = (chunk?: Buffer, cb?: () => void): void => {
      if (chunk) {
        stream.end(chunk, cb);
      } else {
        stream.end(cb);
      }
    };
  }
}
