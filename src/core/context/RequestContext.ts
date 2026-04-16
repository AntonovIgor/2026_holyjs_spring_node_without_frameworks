import { AsyncLocalStorage } from 'node:async_hooks';

import type { Logger } from '../logger/Logger.js';

/**
 * Данные контекста текущего HTTP-запроса.
 *
 * Хранится в AsyncLocalStorage, поэтому доступен из любого места кода
 * в рамках одного запроса — без явной передачи через параметры.
 */
export interface RequestContext {
  traceId: string;
  startedAt: number;
  logger: Logger;
  userId?: string;
}

/**
 * AsyncLocalStorage — встроенный механизм Node.js для хранения
 * контекста в рамках одной асинхронной цепочки вызовов.
 * Аналог thread-local storage в многопоточных языках.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Возвращает контекст текущего запроса или undefined вне запроса. */
export function getContext(): RequestContext | undefined {
  return requestContext.getStore();
}

/** Возвращает traceId текущего запроса. */
export function getTraceId(): string | undefined {
  return requestContext.getStore()?.traceId;
}

/** Возвращает логгер текущего запроса. */
export function getLogger(): Logger | undefined {
  return requestContext.getStore()?.logger;
}
