import type { Middleware, Next } from '../types.js';
import type { Request } from '../../http/Request.js';
import type { Response } from '../../http/Response.js';
import { RequestTimeoutException } from '../../exception/HttpException.js';

/**
 * Ограничивает время обработки запроса.
 *
 * Использует Promise.race: если обработка занимает больше timeoutMs,
 * вызывает req.abort() — все дочерние операции, подписанные на AbortSignal, получат сигнал.
 * По умолчанию — 30 секунд.
 */
export class RequestTimeoutMiddleware implements Middleware {
  readonly name = 'RequestTimeoutMiddleware';

  constructor(private readonly timeoutMs: number = 30_000) {}

  async handle(req: Request, res: Response, next: Next): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeoutError = new RequestTimeoutException();

    try {
      timer = setTimeout(() => { req.abort(timeoutError); }, this.timeoutMs);
      await Promise.race([next(), req.waitForAbort()]);
    } finally {
      clearTimeout(timer);
    }
  }
}
