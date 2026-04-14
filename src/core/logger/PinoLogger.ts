import pino, { type Logger as PinoInstance } from 'pino';

import type { Logger } from './Logger.js';
import { isProd } from '../utils/env.js';

/** Параметры для создания PinoLogger. */
export interface PinoLoggerOptions {
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  pretty?: boolean;
}

/**
 * Реализация Logger на базе библиотеки pino.
 *
 * В dev-режиме автоматически включает pino-pretty для красивого вывода в терминале.
 * В prod-режиме пишет структурированный JSON — удобно для Loki/Datadog/CloudWatch.
 */
export class PinoLogger implements Logger {
  constructor(readonly instance: PinoInstance) {}

  /** Создаёт PinoLogger с нужными настройками. */
  static create(options: PinoLoggerOptions = {}): PinoLogger {
    const isDev = !isProd();
    const level = options.level ?? (isDev ? 'debug' : 'info');
    const usePretty = options.pretty ?? isDev;

    const instance = usePretty
      ? PinoLogger.createPretty(level)
      : pino({ level });

    return new PinoLogger(instance);
  }

  private static createPretty(level: string): PinoInstance {
    try {
      return pino({
        level,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
            messageKey: 'msg',
          },
        },
      });
    } catch {
      // Если pino-pretty не установлен — откатываемся к JSON-формату
      return pino({ level });
    }
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    data ? this.instance.debug(data, msg) : this.instance.debug(msg);
  }

  info(msg: string, data?: Record<string, unknown>): void {
    data ? this.instance.info(data, msg) : this.instance.info(msg);
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    data ? this.instance.warn(data, msg) : this.instance.warn(msg);
  }

  error(msg: string, data?: Record<string, unknown>): void {
    data ? this.instance.error(data, msg) : this.instance.error(msg);
  }

  child(bindings: Record<string, unknown>): Logger {
    return new PinoLogger(this.instance.child(bindings));
  }
}
