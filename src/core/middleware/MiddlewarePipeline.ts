import type { Request } from '../http/Request.js';
import type { Response } from '../http/Response.js';
import type { Middleware, Next } from './types.js';

/**
 * Выполняет цепочку middleware последовательно.
 *
 * Реализует паттерн «цепочка обязанностей»: каждый middleware
 * вызывает next() чтобы передать управление следующему.
 * После последнего middleware вызывается finalHandler — обычно обработчик маршрута.
 * Перед каждым шагом проверяется, не прерван ли запрос (AbortSignal).
 */
export class MiddlewarePipeline {
  async run(
    req: Request,
    res: Response,
    middlewares: readonly Middleware[],
    finalHandler: () => Promise<void>,
  ): Promise<void> {
    let index = 0;

    const next: Next = async (): Promise<void> => {
      req.throwIfAborted();

      if (index < middlewares.length) {
        await middlewares[index++]!.handle(req, res, next);
        req.throwIfAborted();
      } else {
        await finalHandler();
        req.throwIfAborted();
      }
    };

    await next();
  }
}
