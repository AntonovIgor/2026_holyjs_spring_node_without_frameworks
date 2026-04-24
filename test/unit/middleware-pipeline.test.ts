import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import test from 'node:test';
import { Request } from '../../src/core/http/Request.js';
import type { Response } from '../../src/core/http/Response.js';
import { MiddlewarePipeline } from '../../src/core/middleware/MiddlewarePipeline.js';
import type { Middleware, Next } from '../../src/core/middleware/types.js';
import { RequestTimeoutException } from '../../src/core/exception/HttpException.js';

function createRequest(): Request {
  return new Request({
    url: '/',
    method: 'GET',
    headers: { host: 'localhost' },
  } as IncomingMessage);
}

function makeMiddleware(name: string, order: string[]): Middleware {
  return {
    name,
    async handle(_req, _res, next): Promise<void> {
      order.push(`before:${name}`);
      await next();
      order.push(`after:${name}`);
    },
  };
}

const pipeline = new MiddlewarePipeline();

test('pipeline executes middlewares in order and wraps finalHandler', async () => {
  const order: string[] = [];
  const req = createRequest();

  await pipeline.run(
    req,
    {} as Response,
    [makeMiddleware('A', order), makeMiddleware('B', order)],
    async () => { order.push('final'); },
  );

  assert.deepEqual(order, ['before:A', 'before:B', 'final', 'after:B', 'after:A']);
});

test('pipeline calls finalHandler when middleware list is empty', async () => {
  let called = false;
  await pipeline.run(createRequest(), {} as Response, [], async () => { called = true; });
  assert.ok(called);
});

test('pipeline propagates error thrown by middleware', async () => {
  const err = new Error('boom');
  const mw: Middleware = { name: 'err', async handle() { throw err; } };
  await assert.rejects(
    pipeline.run(createRequest(), {} as Response, [mw], async () => {}),
    (e: unknown) => e === err,
  );
});

test('pipeline propagates error thrown by finalHandler', async () => {
  const err = new Error('final boom');
  await assert.rejects(
    pipeline.run(createRequest(), {} as Response, [], async () => { throw err; }),
    (e: unknown) => e === err,
  );
});

test('pipeline stops chain when request is aborted between middlewares', async () => {
  const req = createRequest();
  const order: string[] = [];

  const first: Middleware = {
    name: 'first',
    async handle(_req, _res, next): Promise<void> {
      order.push('first');
      req.abort(new RequestTimeoutException());
      await next();
    },
  };
  const second: Middleware = {
    name: 'second',
    async handle(_req, _res, next): Promise<void> {
      order.push('second');
      await next();
    },
  };

  await assert.rejects(
    pipeline.run(req, {} as Response, [first, second], async () => { order.push('final'); }),
    RequestTimeoutException,
  );

  assert.deepEqual(order, ['first']);
});

test('middleware calling next() twice executes later stages only once', async () => {
  const order: string[] = [];
  const mw: Middleware = {
    name: 'double-next',
    async handle(_req, _res, next: Next): Promise<void> {
      await next();
      await next();
    },
  };
  await pipeline.run(
    createRequest(),
    {} as Response,
    [mw],
    async () => { order.push('final'); },
  );
  assert.deepEqual(order, ['final', 'final']);
});
