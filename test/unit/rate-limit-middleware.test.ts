import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';
import { TooManyRequestsException } from '../../src/core/exception/HttpException.js';
import { Request } from '../../src/core/http/Request.js';
import { Response } from '../../src/core/http/Response.js';
import { RateLimitMiddleware } from '../../src/core/middleware/built-in/RateLimitMiddleware.js';

function createContext(ip = '1.2.3.4'): { req: Request; res: Response; resHeaders: Record<string, string> } {
  const req = new Request({
    url: '/',
    method: 'GET',
    headers: { host: 'localhost' },
    socket: { remoteAddress: ip } as never,
  } as IncomingMessage);

  const resHeaders: Record<string, string> = {};
  const raw = {
    statusCode: 200,
    setHeader(name: string, value: string) { resHeaders[name.toLowerCase()] = value; },
    getHeader(name: string) { return resHeaders[name.toLowerCase()]; },
    removeHeader(name: string) { delete resHeaders[name.toLowerCase()]; },
    end() {},
    headersSent: false,
  } as unknown as ServerResponse;

  return { req, res: new Response(raw), resHeaders };
}

test('requests within limit pass through', async () => {
  const middleware = new RateLimitMiddleware({ maxTokens: 3, refillRate: 1 });
  let count = 0;
  const next = async (): Promise<void> => { count++; };

  for (let i = 0; i < 3; i++) {
    const { req, res } = createContext();
    await middleware.handle(req, res, next);
  }

  assert.equal(count, 3);
});

test('request exceeding limit throws TooManyRequestsException', async () => {
  const middleware = new RateLimitMiddleware({ maxTokens: 1, refillRate: 1 });
  const { req: req1, res: res1 } = createContext();
  const { req: req2, res: res2 } = createContext();

  await middleware.handle(req1, res1, async () => {});
  await assert.rejects(
    middleware.handle(req2, res2, async () => {}),
    TooManyRequestsException,
  );
});

test('Retry-After header is set when limit exceeded', async () => {
  const middleware = new RateLimitMiddleware({ maxTokens: 1, refillRate: 1 });
  const { req: req1, res: res1 } = createContext();
  const { req: req2, res: res2, resHeaders } = createContext();

  await middleware.handle(req1, res1, async () => {});
  await assert.rejects(middleware.handle(req2, res2, async () => {}), TooManyRequestsException);
  assert.ok(resHeaders['retry-after'] !== undefined);
});

test('different keys are tracked independently', async () => {
  const middleware = new RateLimitMiddleware({ maxTokens: 1, refillRate: 1 });
  const { req: req1, res: res1 } = createContext('1.1.1.1');
  const { req: req2, res: res2 } = createContext('2.2.2.2');

  await middleware.handle(req1, res1, async () => {});
  // second client has its own bucket — should pass
  await middleware.handle(req2, res2, async () => {});
});

test('custom keyFn is used for bucketing', async () => {
  const middleware = new RateLimitMiddleware({
    maxTokens: 1,
    refillRate: 1,
    keyFn: (req) => req.headers['x-user-id'] as string ?? 'anon',
  });

  const makeReq = (userId: string): Request =>
    new Request({
      url: '/',
      method: 'GET',
      headers: { host: 'localhost', 'x-user-id': userId },
      socket: { remoteAddress: '1.1.1.1' } as never,
    } as IncomingMessage);

  const raw = {
    statusCode: 200, setHeader() {}, getHeader() {}, removeHeader() {}, end() {}, headersSent: false,
  } as unknown as ServerResponse;
  const res = new Response(raw);

  await middleware.handle(makeReq('user-1'), res, async () => {});
  // user-1 is now out of tokens
  await assert.rejects(
    middleware.handle(makeReq('user-1'), res, async () => {}),
    TooManyRequestsException,
  );
  // user-2 has fresh bucket
  await middleware.handle(makeReq('user-2'), res, async () => {});
});

test('tokens refill over time', async () => {
  // refillRate: 100 tokens/sec, after 20ms we should have ~2 new tokens
  const middleware = new RateLimitMiddleware({ maxTokens: 2, refillRate: 100 });
  const raw = {
    statusCode: 200, setHeader() {}, getHeader() {}, removeHeader() {}, end() {}, headersSent: false,
  } as unknown as ServerResponse;
  const res = new Response(raw);

  // exhaust tokens
  for (let i = 0; i < 2; i++) {
    const { req } = createContext();
    await middleware.handle(req, res, async () => {});
  }

  // wait for refill
  await delay(30);

  // should pass again
  const { req, res: res2 } = createContext();
  await middleware.handle(req, res2, async () => {});
});
