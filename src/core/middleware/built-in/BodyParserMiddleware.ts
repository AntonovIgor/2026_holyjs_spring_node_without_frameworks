import type { Middleware, Next } from '../types.js';
import type { Request } from '../../http/Request.js';
import type { Response } from '../../http/Response.js';
import { PayloadTooLargeException } from '../../exception/HttpException.js';

/** Настройки BodyParserMiddleware. */
export interface BodyParserOptions {
  maxBodySize?: number;
}

/**
 * Устанавливает максимальный размер тела запроса.
 *
 * Если заголовок Content-Length уже превышает лимит — сразу отвечает 413,
 * не читая тело. Иначе передаёт лимит в Request, который проверит его при чтении.
 * По умолчанию — 1 МБ.
 */
export class BodyParserMiddleware implements Middleware {
  readonly name = 'BodyParserMiddleware';

  private readonly maxBodySize: number;

  constructor(options: BodyParserOptions = {}) {
    this.maxBodySize = options.maxBodySize ?? 1_048_576;
  }

  async handle(req: Request, res: Response, next: Next): Promise<void> {
    const contentLength = req.headers['content-length'];
    if (contentLength !== undefined && parseInt(contentLength, 10) > this.maxBodySize) {
      throw new PayloadTooLargeException('Request body too large');
    }

    req.maxBodySize = this.maxBodySize;
    await next();
  }
}
