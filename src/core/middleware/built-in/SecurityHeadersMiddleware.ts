import type { Middleware, Next } from '../types.js';
import type { Request } from '../../http/Request.js';
import type { Response } from '../../http/Response.js';

/**
 * Добавляет базовые заголовки безопасности к каждому ответу.
 *
 * Защищает от распространённых атак: кликджекинга (X-Frame-Options),
 * MIME-сниффинга (X-Content-Type-Options), XSS (X-XSS-Protection)
 * и утечки Referer (Referrer-Policy).
 */
export class SecurityHeadersMiddleware implements Middleware {
  readonly name = 'SecurityHeadersMiddleware';

  async handle(_req: Request, res: Response, next: Next): Promise<void> {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    await next();
  }
}
