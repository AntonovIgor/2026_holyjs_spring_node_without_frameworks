import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';
import { GlobalExceptionHandler } from '../../src/core/exception/GlobalExceptionHandler.js';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '../../src/core/exception/HttpException.js';
import type { ExceptionFilter } from '../../src/core/exception/types.js';
import { Request } from '../../src/core/http/Request.js';
import { Response } from '../../src/core/http/Response.js';
import type { Logger } from '../../src/core/logger/Logger.js';

const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
};

function createContext(alreadySent = false): {
  req: Request;
  res: Response;
  status: () => number;
  body: () => Record<string, unknown>;
} {
  const req = new Request({
    url: '/',
    method: 'GET',
    headers: { host: 'localhost' },
  } as IncomingMessage);

  let statusCode = 200;
  let rawBody = '';
  let ended = alreadySent;
  const headers: Record<string, string | string[]> = {};

  const raw = {
    get statusCode() { return statusCode; },
    set statusCode(v: number) { statusCode = v; },
    setHeader(name: string, value: string | string[]) { headers[name.toLowerCase()] = value; },
    getHeader(name: string): string | number | string[] | undefined { return headers[name.toLowerCase()]; },
    removeHeader(name: string) { delete headers[name.toLowerCase()]; },
    end(data?: unknown) { rawBody = typeof data === 'string' ? data : ''; ended = true; },
    get headersSent() { return ended; },
  } as unknown as ServerResponse;

  return {
    req,
    res: new Response(raw),
    status: () => statusCode,
    body: () => JSON.parse(rawBody || '{}') as Record<string, unknown>,
  };
}

test('HttpException is serialized with statusCode and message', async () => {
  const handler = new GlobalExceptionHandler(silentLogger);
  const { req, res, status, body } = createContext();

  await handler.handle(new NotFoundException('not here'), req, res);

  assert.equal(status(), 404);
  assert.equal(body()['statusCode'], 404);
  assert.equal(body()['message'], 'not here');
});

test('HttpException with details includes details in body', async () => {
  const handler = new GlobalExceptionHandler(silentLogger);
  const { req, res, body } = createContext();
  const details = [{ field: 'name', message: 'required' }];

  await handler.handle(new UnprocessableEntityException('Validation failed', details), req, res);

  assert.deepEqual(body()['details'], details);
});

test('non-HttpException returns 500 with generic message', async () => {
  const handler = new GlobalExceptionHandler(silentLogger);
  const { req, res, status, body } = createContext();

  await handler.handle(new Error('db crashed'), req, res);

  assert.equal(status(), 500);
  assert.equal(body()['statusCode'], 500);
  assert.equal(body()['message'], 'Internal Server Error');
});

test('non-HttpException in non-prod includes stack in body', async () => {
  const orig = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'development';

  try {
    const handler = new GlobalExceptionHandler(silentLogger);
    const { req, res, body } = createContext();

    await handler.handle(new Error('oops'), req, res);

    assert.ok(typeof body()['stack'] === 'string');
  } finally {
    if (orig !== undefined) process.env['NODE_ENV'] = orig;
    else delete process.env['NODE_ENV'];
  }
});

test('non-HttpException in production omits stack', async () => {
  const orig = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';

  try {
    const handler = new GlobalExceptionHandler(silentLogger);
    const { req, res, body } = createContext();

    await handler.handle(new Error('oops'), req, res);

    assert.equal(body()['stack'], undefined);
  } finally {
    if (orig !== undefined) process.env['NODE_ENV'] = orig;
    else delete process.env['NODE_ENV'];
  }
});

test('does nothing when response is already sent', async () => {
  const handler = new GlobalExceptionHandler(silentLogger);
  const { req, res, status } = createContext(true);

  await handler.handle(new NotFoundException(), req, res);

  // Status was never changed from default 200
  assert.equal(status(), 200);
});

test('custom ExceptionFilter catches the exception', async () => {
  const handler = new GlobalExceptionHandler(silentLogger);
  const filter: ExceptionFilter = {
    async catch(_err, _req, res) {
      res.status(418).json({ teapot: true });
    },
  };
  handler.addFilter(filter);

  const { req, res, status, body } = createContext();
  await handler.handle(new Error('whatever'), req, res);

  assert.equal(status(), 418);
  assert.equal(body()['teapot'], true);
});

test('filter that throws falls through to default handling', async () => {
  const handler = new GlobalExceptionHandler(silentLogger);
  const badFilter: ExceptionFilter = {
    async catch() { throw new Error('filter itself failed'); },
  };
  handler.addFilter(badFilter);

  const { req, res, status } = createContext();
  await handler.handle(new NotFoundException('item'), req, res);

  assert.equal(status(), 404);
});

test('second filter is skipped when first filter sends response', async () => {
  const handler = new GlobalExceptionHandler(silentLogger);
  let secondCalled = false;

  const first: ExceptionFilter = {
    async catch(_err, _req, res) { res.status(400).json({}); },
  };
  const second: ExceptionFilter = {
    async catch() { secondCalled = true; },
  };
  handler.addFilter(first);
  handler.addFilter(second);

  const { req, res } = createContext();
  await handler.handle(new Error('e'), req, res);

  assert.equal(secondCalled, false);
});
