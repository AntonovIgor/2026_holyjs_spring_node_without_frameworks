import type { Middleware, Next } from '../types.js';
import type { Request } from '../../http/Request.js';
import type { Response } from '../../http/Response.js';

/** Настройки CORS-политики. */
export interface CorsOptions {
  origins?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * Добавляет заголовки CORS к каждому ответу.
 *
 * Поддерживает гибкую настройку разрешённых источников: строка, массив или функция.
 * Preflight-запросы (OPTIONS) обрабатываются сразу, без передачи дальше по цепочке.
 */
export class CorsMiddleware implements Middleware {
  readonly name = 'CorsMiddleware';

  private readonly methods: string;
  private readonly allowedHeaders: string;

  constructor(private readonly options: CorsOptions = {}) {
    this.methods = (options.methods ?? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']).join(', ');
    this.allowedHeaders = (options.allowedHeaders ?? ['Content-Type', 'Authorization']).join(', ');
  }

  async handle(req: Request, res: Response, next: Next): Promise<void> {
    const origin = req.headers['origin'] as string | undefined;

    if (origin && this.isAllowed(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    } else if (!origin) {
      res.header('Access-Control-Allow-Origin', '*');
    }

    res.header('Access-Control-Allow-Methods', this.methods);
    res.header('Access-Control-Allow-Headers', this.allowedHeaders);

    if (this.options.credentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    if (this.options.maxAge !== undefined) {
      res.header('Access-Control-Max-Age', String(this.options.maxAge));
    }

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    await next();
  }

  private isAllowed(origin: string): boolean {
    const { origins } = this.options;
    if (!origins) {
      return true;
    }

    if (typeof origins === 'function') {
      return origins(origin);
    }

    if (Array.isArray(origins)) {
      return origins.includes(origin);
    }

    return origins === origin;
  }
}
