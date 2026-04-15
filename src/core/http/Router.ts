import type { Request } from './Request.js';
import type { Response } from './Response.js';

/** Тип обработчика маршрута. */
export type RouteHandler = (req: Request, res: Response) => Promise<void> | void;

interface Route {
  method: string;
  pattern: URLPattern;
  handler: RouteHandler;
}

/**
 * Маршрутизатор на базе URLPattern API (доступен нативно в Node.js 22+).
 *
 * Поддерживает параметры пути в стиле `/users/:id`.
 * Методы `.get()`, `.post()` и прочие возвращают `this` для чейнинга.
 */
export class Router {
  private readonly routes: Route[] = [];

  /** Регистрирует маршрут с произвольным HTTP-методом. */
  register(method: string, path: string, handler: RouteHandler): void {
    this.routes.push({
      method: method.toUpperCase(),
      pattern: new URLPattern({ pathname: path }),
      handler,
    });
  }

  get(path: string, handler: RouteHandler): this {
    this.register('GET', path, handler);
    return this;
  }

  post(path: string, handler: RouteHandler): this {
    this.register('POST', path, handler);
    return this;
  }

  put(path: string, handler: RouteHandler): this {
    this.register('PUT', path, handler);
    return this;
  }

  patch(path: string, handler: RouteHandler): this {
    this.register('PATCH', path, handler);
    return this;
  }

  delete(path: string, handler: RouteHandler): this {
    this.register('DELETE', path, handler);
    return this;
  }

  /**
   * Ищет подходящий маршрут для запроса.
   * Возвращает обработчик и извлечённые path-параметры или null, если ничего не найдено.
   */
  match(req: Request): { handler: RouteHandler; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== req.method) {
        continue;
      }

      const result = route.pattern.exec({ pathname: req.pathname });
      if (!result) {
        continue;
      }

      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(result.pathname.groups)) {
        if (value != null) {
          params[key] = value;
        }
      }
      return { handler: route.handler, params };
    }
    return null;
  }
}
