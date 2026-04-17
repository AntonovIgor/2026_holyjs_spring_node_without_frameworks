import type { Middleware, Next } from '../types.js';
import type { Request } from '../../http/Request.js';
import type { Response } from '../../http/Response.js';
import { getLogger } from '../../context/RequestContext.js';

/**
 * Логирует начало и конец обработки запроса на уровне debug.
 *
 * Читает логгер из RequestContext — он уже содержит traceId и другие поля.
 * Если контекст ещё не создан (например, в тестах), просто пропускает запрос дальше.
 */
export class LoggerMiddleware implements Middleware {
  readonly name = 'LoggerMiddleware';

  async handle(req: Request, res: Response, next: Next): Promise<void> {
    const logger = getLogger();
    if (!logger) {
      return next();
    }

    const start = Date.now();
    logger.debug('middleware: request start', { method: req.method, path: req.pathname });

    await next();

    logger.debug('middleware: request end', {
      method: req.method,
      path: req.pathname,
      status: res.raw.statusCode,
      ms: Date.now() - start,
    });
  }
}
