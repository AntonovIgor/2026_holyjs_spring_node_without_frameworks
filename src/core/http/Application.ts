import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';

import { Request } from './Request.js';
import { Response } from './Response.js';
import { Router } from './Router.js';
import { MiddlewarePipeline } from '../middleware/MiddlewarePipeline.js';
import { GlobalExceptionHandler } from '../exception/GlobalExceptionHandler.js';
import { requestContext } from '../context/RequestContext.js';
import { PinoLogger } from '../logger/PinoLogger.js';
import { LOGGER_KEY } from '../logger/Logger.js';
import type { Logger, PinoLoggerOptions } from '../logger/index.js';
import type { Middleware } from '../middleware/types.js';
import type { ExceptionFilter } from '../exception/types.js';
import type { AppModule } from '../module/AppModule.js';

/** Настройки при создании приложения. */
export interface ApplicationOptions {
  /** Кастомный логгер. По умолчанию — PinoLogger (JSON в prod, pretty в dev). */
  logger?: Logger;
  /** Опции дефолтного PinoLogger. Игнорируется, если передан logger. */
  loggerOptions?: PinoLoggerOptions;
  /** Таймаут ожидания активных запросов при shutdown. По умолчанию — 30 000 мс. */
  drainTimeoutMs?: number;
}

/**
 * Центральный класс фреймворка.
 *
 * Собирает воедино HTTP-сервер, маршрутизатор, цепочку middleware
 * и глобальную обработку ошибок. Поддерживает graceful shutdown:
 * при остановке ждёт завершения всех активных запросов.
 *
 * @example
 * const app = new Application();
 * app.use(new LoggerMiddleware()).registerModule(usersModule);
 * await app.listen(3000);
 */
export class Application {
  readonly logger: Logger;

  private readonly server: Server;
  private readonly router: Router;
  private readonly exceptionHandler: GlobalExceptionHandler;
  private readonly pipeline: MiddlewarePipeline;
  private readonly middlewares: Middleware[] = [];
  private readonly modules: AppModule[] = [];
  private readonly bootstrapMiddleware: Middleware;
  private readonly drainTimeoutMs: number;

  private activeRequests = 0;
  private draining = false;
  private drainResolve: (() => void) | null = null;

  constructor(options: ApplicationOptions = {}) {
    this.drainTimeoutMs = options.drainTimeoutMs ?? 30_000;
    this.logger = options.logger ?? PinoLogger.create(options.loggerOptions);
    this.router = new Router();
    this.exceptionHandler = new GlobalExceptionHandler(this.logger);
    this.pipeline = new MiddlewarePipeline();
    this.bootstrapMiddleware = this.buildBootstrapMiddleware();
    this.server = createServer(
      (req: IncomingMessage, res: ServerResponse) => void this.processRequest(req, res),
    );
  }

  /** Добавляет middleware в глобальную цепочку. */
  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /** Добавляет фильтр исключений, который вызывается перед стандартной обработкой. */
  addExceptionFilter(filter: ExceptionFilter): this {
    this.exceptionHandler.addFilter(filter);
    return this;
  }

  /** Регистрирует модуль приложения — подключает его маршруты к роутеру. */
  registerModule(mod: AppModule): this {
    mod.register(this.router);
    this.modules.push(mod);
    return this;
  }

  /** Возвращает адрес, на котором слушает сервер (после вызова listen). */
  address(): AddressInfo {
    return this.server.address() as AddressInfo;
  }

  /** Запускает HTTP-сервер и вызывает onStart у всех модулей. */
  async listen(port: number, host = '0.0.0.0'): Promise<void> {
    this.registerProcessHandlers();
    for (const mod of this.modules) {
      await mod.onStart();
    }
    return new Promise((resolve) => {
      this.server.listen(port, host, resolve);
    });
  }

  /** Graceful shutdown: останавливает приём новых запросов и ждёт завершения текущих. */
  async close(): Promise<void> {
    this.server.close();

    this.draining = true;
    await this.waitForDrain();

    this.server.closeAllConnections();

    for (const mod of this.modules) {
      await mod.onStop();
    }
  }

  private registerProcessHandlers(): void {
    const shutdown = (reason: string, err: unknown): void => {
      this.logger.error(reason, {
        err: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
      });
      this.close().finally(() => { process.exit(1); });
    };

    process.once('uncaughtException', (err) => { shutdown('uncaughtException', err); });
    process.once('unhandledRejection', (reason) => { shutdown('unhandledRejection', reason); });
  }

  private waitForDrain(): Promise<void> {
    if (this.activeRequests === 0) {
      return Promise.resolve();
    }

    this.logger.info('graceful shutdown: waiting for active requests', {
      activeRequests: this.activeRequests,
      timeoutMs: this.drainTimeoutMs,
    });

    return new Promise<void>((resolve) => {
      let timer: NodeJS.Timeout;

      const done = (): void => {
        clearTimeout(timer);
        this.drainResolve = null;
        resolve();
      };

      this.drainResolve = done;
      timer = setTimeout(() => {
        this.logger.warn('graceful shutdown: drain timeout exceeded, forcing close', {
          activeRequests: this.activeRequests,
        });
        done();
      }, this.drainTimeoutMs);
    });
  }

  private async processRequest(rawReq: IncomingMessage, rawRes: ServerResponse): Promise<void> {
    this.activeRequests++;

    const req = new Request(rawReq);
    const res = new Response(rawRes);
    const startedAt = Date.now();

    try {
      await this.pipeline.run(
        req,
        res,
        [this.bootstrapMiddleware, ...this.middlewares],
        async () => {
          const match = this.router.match(req);
          if (!match) {
            res.status(404).json({ statusCode: 404, message: 'Not Found', path: req.pathname });
            return;
          }
          req.params = match.params;
          await match.handler(req, res);
        },
      );
    } catch (err) {
      await this.exceptionHandler.handle(err, req, res);
    } finally {
      this.activeRequests--;
      if (this.draining && this.activeRequests === 0) {
        this.drainResolve?.();
      }
    }

    const logger = req.get<Logger>(LOGGER_KEY) ?? this.logger;
    logger.info('request completed', { status: res.raw.statusCode, ms: Date.now() - startedAt });
  }

  /**
   * Встроенный bootstrap-middleware: назначает traceId, создаёт дочерний логгер
   * и запускает весь pipeline внутри AsyncLocalStorage-контекста запроса.
   */
  private buildBootstrapMiddleware(): Middleware {
    const rootLogger = this.logger;

    return {
      name: 'ApplicationBootstrap',

      async handle(req: Request, res: Response, next: () => Promise<void>): Promise<void> {
        const traceId =
          (req.headers['x-trace-id'] as string | undefined) ?? randomUUID();

        const requestLogger = rootLogger.child({
          traceId,
          method: req.method,
          path: req.pathname,
        });

        res.header('X-Trace-Id', traceId);
        req.set(LOGGER_KEY, requestLogger);

        requestLogger.info('request received');

        await requestContext.run(
          { traceId, startedAt: Date.now(), logger: requestLogger },
          next,
        );
      },
    };
  }
}
