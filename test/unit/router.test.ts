import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import test from 'node:test';
import { Request } from '../../src/core/http/Request.js';
import { Router } from '../../src/core/http/Router.js';

function createRequest(method: string, url: string): Request {
  return new Request({
    url,
    method,
    headers: { host: 'localhost' },
  } as IncomingMessage);
}

const noop = async (): Promise<void> => {};

test('Router matches exact path', () => {
  const router = new Router();
  router.get('/hello', noop);
  const match = router.match(createRequest('GET', '/hello'));
  assert.ok(match);
  assert.deepEqual(match.params, {});
});

test('Router extracts path params', () => {
  const router = new Router();
  router.get('/users/:id', noop);
  const match = router.match(createRequest('GET', '/users/42'));
  assert.ok(match);
  assert.equal(match.params.id, '42');
});

test('Router extracts multiple path params', () => {
  const router = new Router();
  router.get('/orgs/:org/repos/:repo', noop);
  const match = router.match(createRequest('GET', '/orgs/acme/repos/api'));
  assert.ok(match);
  assert.equal(match.params.org, 'acme');
  assert.equal(match.params.repo, 'api');
});

test('Router returns null on method mismatch', () => {
  const router = new Router();
  router.get('/hello', noop);
  assert.equal(router.match(createRequest('POST', '/hello')), null);
});

test('Router returns null when no route matches', () => {
  const router = new Router();
  router.get('/hello', noop);
  assert.equal(router.match(createRequest('GET', '/world')), null);
});

test('Router picks first matching route', () => {
  const router = new Router();
  const first = async (): Promise<void> => {};
  const second = async (): Promise<void> => {};
  router.get('/hello', first);
  router.get('/hello', second);
  const match = router.match(createRequest('GET', '/hello'));
  assert.equal(match?.handler, first);
});

test('Router registers POST, PUT, PATCH, DELETE routes', () => {
  const router = new Router();
  router.post('/a', noop);
  router.put('/b', noop);
  router.patch('/c', noop);
  router.delete('/d', noop);

  assert.ok(router.match(createRequest('POST', '/a')));
  assert.ok(router.match(createRequest('PUT', '/b')));
  assert.ok(router.match(createRequest('PATCH', '/c')));
  assert.ok(router.match(createRequest('DELETE', '/d')));
});
