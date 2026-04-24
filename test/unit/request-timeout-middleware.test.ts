import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import type { IncomingMessage } from 'node:http';
import test from 'node:test';
import { Request } from '../../src/core/http/Request.js';
import type { Response } from '../../src/core/http/Response.js';
import { RequestTimeoutException } from '../../src/core/exception/HttpException.js';
import { RequestTimeoutMiddleware } from '../../src/core/middleware/built-in/RequestTimeoutMiddleware.js';

function createRequest(): Request {
  return new Request({
    url: '/',
    method: 'GET',
    headers: { host: 'localhost' },
  } as IncomingMessage);
}

test('RequestTimeoutMiddleware does not throw when handler completes before timeout', async () => {
  const middleware = new RequestTimeoutMiddleware(200);
  const req = createRequest();
  let handlerCompleted = false;

  await middleware.handle(req, {} as Response, async () => {
    await delay(10);
    handlerCompleted = true;
  });

  assert.ok(handlerCompleted);
  assert.ok(!req.signal.aborted);
});

test('RequestTimeoutMiddleware aborts cooperative downstream work', async () => {
  const middleware = new RequestTimeoutMiddleware(20);
  const req = createRequest();
  let sideEffect = false;

  await assert.rejects(
    middleware.handle(req, {} as Response, async () => {
      try {
        await delay(100, undefined, { signal: req.signal });
        sideEffect = true;
      } catch (error) {
        if ((error as { name?: string }).name !== 'AbortError') {
          throw error;
        }
        req.throwIfAborted();
      }
    }),
    RequestTimeoutException,
  );

  await delay(50);
  assert.equal(sideEffect, false);
});
