import type { Request } from '../http/Request.js';
import type { Response } from '../http/Response.js';

/** Функция перехода к следующему middleware в цепочке. */
export type Next = () => Promise<void>;

/**
 * Контракт для middleware.
 *
 * Каждый middleware получает запрос, ответ и функцию `next()`.
 * Вызов `next()` передаёт управление следующему middleware или финальному обработчику.
 * Если `next()` не вызвать — цепочка прерывается (например, при 415 или 429).
 */
export interface Middleware {
  readonly name: string;
  handle(req: Request, res: Response, next: Next): Promise<void>;
}
