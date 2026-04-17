import { randomUUID } from 'node:crypto';

import type { Middleware, Next } from '../types.js';
import type { Request } from '../../http/Request.js';
import type { Response } from '../../http/Response.js';
import type { Logger } from '../../logger/Logger.js';
import { requestContext } from '../../context/RequestContext.js';

/**
 * Устанавливает traceId и создаёт RequestContext для цепочки вызовов.
 *
 * При использовании класса Application этот middleware не нужен —
 * bootstrap делает то же самое автоматически.
 * Полезен в юнит-тестах или нестандартных серверных настройках,
 * когда нужен контекст без полного Application.
 */
export class TraceMiddleware implements Middleware {
  readonly name = 'TraceMiddleware';

  constructor(private readonly logger: Logger) {}

  async handle(req: Request, res: Response, next: Next): Promise<void> {
    if (requestContext.getStore()) {
      return next();
    }

    const traceId = (req.headers['x-trace-id'] as string | undefined) ?? randomUUID();
    const logger = this.logger.child({ traceId });

    res.header('X-Trace-Id', traceId);

    await requestContext.run({ traceId, startedAt: Date.now(), logger }, next);
  }
}
