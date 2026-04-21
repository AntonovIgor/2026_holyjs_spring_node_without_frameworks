import type { Middleware, Next } from '../middleware/types.js';
import type { Request } from '../http/Request.js';
import type { Response } from '../http/Response.js';
import { HttpException, UnprocessableEntityException } from '../exception/HttpException.js';
import { validate } from './decorators.js';

/** Ключ для хранения провалидированного тела запроса в Request.extras. */
export const VALIDATED_BODY_KEY = Symbol('validated:body');

/** Ключ для хранения провалидированных query-параметров в Request.extras. */
export const VALIDATED_QUERY_KEY = Symbol('validated:query');

/** Ключ для хранения провалидированных path-параметров в Request.extras. */
export const VALIDATED_PARAMS_KEY = Symbol('validated:params');

/**
 * Middleware-фабрика для валидации тела запроса.
 *
 * Десериализует JSON, прогоняет через декораторы DTO-класса
 * и кладёт провалидированный объект в Request по ключу VALIDATED_BODY_KEY.
 */
export function validationPipe<T extends object>(DtoClass: new () => T): Middleware {
  return {
    name: `ValidationPipe(${DtoClass.name})`,

    async handle(req: Request, _res: Response, next: Next): Promise<void> {
      let body: unknown;
      try {
        body = await req.body.json();
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }
        throw new UnprocessableEntityException('Invalid JSON body');
      }

      const errors = validate(DtoClass, body);
      if (errors.length > 0) {
        throw new UnprocessableEntityException('Validation failed', errors);
      }

      req.set(VALIDATED_BODY_KEY, body as T);
      await next();
    },
  };
}

/**
 * Middleware-фабрика для валидации query-параметров.
 * Строковые значения автоматически приводятся к числам и булевым.
 */
export function queryPipe<T extends object>(DtoClass: new () => T): Middleware {
  return {
    name: `QueryPipe(${DtoClass.name})`,

    async handle(req: Request, _res: Response, next: Next): Promise<void> {
      const raw: Record<string, string> = {};
      req.query.forEach((value, key) => { raw[key] = value; });

      const data = coerceStrings(raw);
      const errors = validate(DtoClass, data);
      if (errors.length > 0) {
        throw new UnprocessableEntityException('Query validation failed', errors);
      }

      req.set(VALIDATED_QUERY_KEY, data as T);
      await next();
    },
  };
}

/**
 * Middleware-фабрика для валидации path-параметров.
 * Строковые значения автоматически приводятся к числам и булевым.
 */
export function paramsPipe<T extends object>(DtoClass: new () => T): Middleware {
  return {
    name: `ParamsPipe(${DtoClass.name})`,

    async handle(req: Request, _res: Response, next: Next): Promise<void> {
      const data = coerceStrings(req.params);
      const errors = validate(DtoClass, data);
      if (errors.length > 0) {
        throw new UnprocessableEntityException('Params validation failed', errors);
      }

      req.set(VALIDATED_PARAMS_KEY, data as T);
      await next();
    },
  };
}

/** Приводит строковые значения к числам и булевым, где это возможно. */
function coerceStrings(record: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === 'true') {
      result[key] = true;
    } else if (value === 'false') {
      result[key] = false;
    } else if (value.trim() !== '' && !Number.isNaN(Number(value))) {
      result[key] = Number(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
