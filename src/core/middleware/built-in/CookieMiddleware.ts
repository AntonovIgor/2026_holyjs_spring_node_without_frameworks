import type { Middleware, Next } from '../types.js';
import type { Request } from '../../http/Request.js';
import type { Response } from '../../http/Response.js';

/** Ключ для доступа к распарсенным куки из Request.extras. */
export const COOKIES_KEY = Symbol('cookies');

/**
 * Парсит заголовок Cookie и сохраняет куки в Request.
 * Для получения куки в обработчике используйте функцию getCookies().
 */
export class CookieMiddleware implements Middleware {
  readonly name = 'CookieMiddleware';

  async handle(req: Request, _res: Response, next: Next): Promise<void> {
    const header = (req.headers['cookie'] as string | undefined) ?? '';
    req.set(COOKIES_KEY, parseCookies(header));
    await next();
  }
}

/** Возвращает распарсенные куки из запроса. */
export function getCookies(req: Request): Record<string, string> {
  return req.get<Record<string, string>>(COOKIES_KEY) ?? {};
}

/** Разбирает строку заголовка Cookie в словарь имя → значение. */
function parseCookies(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) {
    return result;
  }

  for (const pair of header.split(';')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) {
      continue;
    }

    const name = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();

    if (name) {
      try {
        result[name] = decodeURIComponent(value);
      } catch {
        result[name] = value;
      }
    }
  }

  return result;
}
