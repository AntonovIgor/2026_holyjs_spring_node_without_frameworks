import type { Middleware, Next } from '../types.js';
import type { Request } from '../../http/Request.js';
import type { Response } from '../../http/Response.js';
import { UnsupportedMediaTypeException } from '../../exception/HttpException.js';

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

/**
 * Проверяет, что запросы с телом имеют Content-Type: application/json.
 *
 * Актуально для API, которые принимают только JSON.
 * Запросы GET, DELETE и другие без тела проходят без проверки.
 */
export class JsonContentTypeMiddleware implements Middleware {
  readonly name = 'JsonContentTypeMiddleware';

  async handle(req: Request, res: Response, next: Next): Promise<void> {
    if (METHODS_WITH_BODY.has(req.method)) {
      const contentType = (req.headers['content-type'] as string | undefined) ?? '';
      if (!contentType.includes('application/json')) {
        throw new UnsupportedMediaTypeException(
          'Content-Type must be application/json',
        );
      }
    }

    await next();
  }
}
