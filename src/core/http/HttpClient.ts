import { getTraceId, getLogger } from '../context/RequestContext.js';

/** Ответ HTTP-клиента. */
export interface HttpClientResponse<T = unknown> {
  status: number;
  headers: Headers;
  data: T;
}

/**
 * Простой HTTP-клиент с автоматическим проброском traceId.
 *
 * Читает traceId и логгер из текущего RequestContext (через AsyncLocalStorage)
 * и добавляет заголовок `x-trace-id` к каждому исходящему запросу.
 * Это позволяет отслеживать цепочку вызовов между сервисами.
 */
export class HttpClient {
  async fetch<T = unknown>(
    url: string,
    options: RequestInit = {},
  ): Promise<HttpClientResponse<T>> {
    const traceId = getTraceId();
    const logger = getLogger();

    const headers = new Headers(options.headers);
    if (traceId !== undefined) {
      headers.set('x-trace-id', traceId);
    }

    const method = options.method ?? 'GET';

    logger?.info('http client request', { method, url, traceId });

    const startedAt = Date.now();
    let response: globalThis.Response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (err) {
      logger?.error('http client error', {
        method,
        url,
        ms: Date.now() - startedAt,
        err: err instanceof Error ? { message: err.message } : String(err),
      });
      throw err;
    }
    const ms = Date.now() - startedAt;

    logger?.info('http client response', { method, url, status: response.status, ms, traceId });

    const data = await this.parseResponse<T>(response);

    return { status: response.status, headers: response.headers, data };
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json() as Promise<T>;
    }
    return response.text() as unknown as Promise<T>;
  }
}
