import type { IncomingMessage } from 'node:http';

import { BadRequestException, PayloadTooLargeException } from '../exception/HttpException.js';

/**
 * Обёртка над IncomingMessage из стандартной библиотеки Node.js.
 *
 * Добавляет удобный API для работы с телом запроса, параметрами URL,
 * AbortSignal и произвольными данными middleware через типобезопасное хранилище.
 */
export class Request {
  readonly url: URL;

  /** Параметры пути — заполняются роутером при совпадении маршрута. */
  params: Record<string, string> = {};

  private readonly abortController = new AbortController();

  /** Хранилище для произвольных данных от middleware (logger, parsed body, cookies...). */
  private readonly extras = new Map<symbol, unknown>();

  private _maxBodySize = 1_048_576;
  private _bodyPromise: Promise<Buffer> | null = null;

  constructor(readonly raw: IncomingMessage) {
    this.url = new URL(
      raw.url ?? '/',
      `http://${raw.headers.host ?? 'localhost'}`,
    );
  }

  get method(): string {
    return this.raw.method ?? 'GET';
  }

  get headers(): IncomingMessage['headers'] {
    return this.raw.headers;
  }

  get query(): URLSearchParams {
    return this.url.searchParams;
  }

  get pathname(): string {
    return this.url.pathname;
  }

  /** AbortSignal, привязанный к этому запросу. Используется для отмены долгих операций. */
  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  set maxBodySize(bytes: number) {
    this._maxBodySize = bytes;
  }

  /** Прерывает обработку запроса — сигнал уходит в middleware и обработчики. */
  abort(reason: unknown = new Error('Request aborted')): void {
    if (this.signal.aborted) return;
    this.abortController.abort(reason);
  }

  /** Бросает исключение, если запрос уже прерван. */
  throwIfAborted(): void {
    this.signal.throwIfAborted();
  }

  /** Возвращает Promise, который никогда не резолвится, но реджектится при abort. */
  waitForAbort(): Promise<never> {
    if (this.signal.aborted) {
      return Promise.reject(this.signal.reason);
    }
    return new Promise<never>((_, reject) => {
      this.signal.addEventListener('abort', () => reject(this.signal.reason), { once: true });
    });
  }

  /** Сохраняет произвольное значение в хранилище запроса. */
  set<T>(key: symbol, value: T): void {
    this.extras.set(key, value);
  }

  /** Читает значение из хранилища запроса по символьному ключу. */
  get<T>(key: symbol): T | undefined {
    return this.extras.get(key) as T | undefined;
  }

  /** Методы для чтения тела запроса в нужном формате. */
  readonly body = {
    json: <T = unknown>(): Promise<T> => this.readBody().then((buf) => JSON.parse(buf.toString()) as T),
    text: (): Promise<string> => this.readBody().then((buf) => buf.toString()),
    buffer: (): Promise<Buffer> => this.readBody(),
  };

  private readBody(): Promise<Buffer> {
    if (this._bodyPromise) {
      return this._bodyPromise;
    }

    this._bodyPromise = new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      let settled = false;

      const cleanup = (): void => {
        this.raw.removeListener('data', onData);
        this.raw.removeListener('end', onEnd);
        this.raw.removeListener('error', onError);
      };

      const rejectOnce = (error: unknown): void => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error);
      };

      const resolveOnce = (buffer: Buffer): void => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(buffer);
      };

      const onData = (chunk: Buffer): void => {
        total += chunk.length;

        // Прерываем стрим, чтобы данные не накапливались после превышения лимита
        if (total > this._maxBodySize) {
          this.raw.pause();
          this.raw.resume();
          rejectOnce(
            new PayloadTooLargeException(`Body exceeds limit of ${this._maxBodySize} bytes`),
          );
          return;
        }

        chunks.push(chunk);
      };

      const onEnd = (): void => { resolveOnce(Buffer.concat(chunks)); };
      const onError = (error: Error): void => {
        rejectOnce(new BadRequestException(error.message));
      };

      this.raw.on('data', onData);
      this.raw.on('end', onEnd);
      this.raw.on('error', onError);
    });

    return this._bodyPromise;
  }
}
