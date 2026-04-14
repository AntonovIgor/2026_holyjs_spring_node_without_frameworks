import type { ExceptionFilter } from './types.js';
import type { Request } from '../http/Request.js';
import type { Response } from '../http/Response.js';
import type { Logger } from '../logger/Logger.js';
import { HttpException } from './HttpException.js';
import { isProd } from '../utils/env.js';
import { LOGGER_KEY } from '../logger/Logger.js';

/**
 * Глобальный обработчик ошибок.
 *
 * Последняя линия защиты: если исключение не поймал ни один ExceptionFilter,
 * оно попадает сюда. HttpException превращается в JSON с нужным статусом,
 * все остальные ошибки — в 500 Internal Server Error.
 * В dev-режиме в ответ добавляется stack trace.
 */
export class GlobalExceptionHandler {
  private readonly filters: ExceptionFilter[] = [];

  constructor(private readonly rootLogger: Logger) {}

  /** Добавляет фильтр, который будет вызван перед стандартной обработкой. */
  addFilter(filter: ExceptionFilter): void {
    this.filters.push(filter);
  }

  async handle(err: unknown, req: Request, res: Response): Promise<void> {
    if (res.sent) {
      return;
    }

    for (const filter of this.filters) {
      try {
        await filter.catch(err, req, res);
        if (res.sent) {
          return;
        }
      } catch {
        // фильтр сам бросил исключение — переходим к следующему
      }
    }

    if (res.sent) {
      return;
    }

    const logger = req.get<Logger>(LOGGER_KEY) ?? this.rootLogger;

    if (err instanceof HttpException) {
      if (err.statusCode >= 500) {
        logger.error('http exception', { statusCode: err.statusCode, message: err.message });
      }
      const body: Record<string, unknown> = {
        statusCode: err.statusCode,
        message: err.message,
      };
      if (err.details !== undefined) {
        body['details'] = err.details;
      }

      res.status(err.statusCode).json(body);
      return;
    }

    logger.error('unhandled exception', {
      err: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
    });

    const isDev = !isProd();

    res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error',
      ...(isDev && err instanceof Error ? { stack: err.stack } : {}),
    });
  }
}
