import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { startApp } from './helpers.js';

test('active request completes before close() resolves', async () => {
  const completed: string[] = [];

  const { app, url } = await startApp((app) => {
    app.registerModule({
      register(router) {
        router.get('/slow', async (_req, res) => {
          await delay(80);
          completed.push('request');
          res.json({ ok: true });
        });
      },
      onStart() {},
      onStop() { completed.push('stop'); },
    });
  });

  // start a slow request, don't await yet
  const fetchPromise = fetch(url('/slow'));

  // give the request time to reach the handler
  await delay(20);

  // close while request is in-flight
  await app.close();
  completed.push('closed');

  // now consume the fetch result
  const res = await fetchPromise;
  assert.equal(res.status, 200);

  // request must complete and onStop must be called before 'closed'
  assert.deepEqual(completed, ['request', 'stop', 'closed']);
});

test('close() resolves immediately when no active requests', async () => {
  const { app } = await startApp(() => {});
  const start = Date.now();
  await app.close();
  assert.ok(Date.now() - start < 500);
});

test('drain timeout forces close after timeout', async () => {
  const { app, url } = await startApp((app) => {
    app.registerModule({
      register(router) {
        router.get('/hang', async (_req, res) => {
          await delay(10_000);
          res.json({ ok: true });
        });
      },
      onStart() {},
      onStop() {},
    });
  }, { drainTimeoutMs: 50 });

  // fire a request that will never complete within the drain window
  const fetchPromise = fetch(url('/hang')).catch(() => null);

  // give the request time to reach the handler
  await delay(20);

  const start = Date.now();
  await app.close();
  const elapsed = Date.now() - start;

  // drain timeout is 50ms — close() must not block indefinitely
  assert.ok(elapsed < 2000, `close() took ${elapsed}ms, expected < 2000ms`);

  await fetchPromise;
});

test('new requests are rejected after close() is initiated', async () => {
  const { app, url } = await startApp((app) => {
    app.registerModule({
      register(router) {
        router.get('/ok', async (_req, res) => {
          res.json({ ok: true });
        });
      },
      onStart() {},
      onStop() {},
    });
  });

  // close the server — stops accepting new connections
  const closePromise = app.close();

  // attempt a new connection after server is closed
  await delay(10);
  await assert.rejects(
    fetch(url('/ok')),
    // fetch will fail because the port is no longer accepting connections
  );

  await closePromise;
});
