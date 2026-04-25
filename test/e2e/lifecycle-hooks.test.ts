import assert from 'node:assert/strict';
import test from 'node:test';
import type { Router } from '../../src/core/http/Router.js';
import { AppModule } from '../../src/core/module/AppModule.js';
import { startApp } from './helpers.js';

class TrackingModule extends AppModule {
  readonly events: string[] = [];

  constructor(private readonly name: string) {
    super();
  }

  register(_router: Router): void {}

  override onStart(): void {
    this.events.push(`${this.name}:start`);
  }

  override onStop(): void {
    this.events.push(`${this.name}:stop`);
  }
}

test('onStart is called before the server accepts connections', async () => {
  const mod = new TrackingModule('mod');

  const { app } = await startApp((app) => {
    app.registerModule(mod);
  });

  assert.deepEqual(mod.events, ['mod:start']);

  await app.close();
  assert.deepEqual(mod.events, ['mod:start', 'mod:stop']);
});

test('multiple modules onStart called in registration order', async () => {
  const a = new TrackingModule('A');
  const b = new TrackingModule('B');

  const { app } = await startApp((app) => {
    app.registerModule(a);
    app.registerModule(b);
  });

  assert.deepEqual(a.events, ['A:start']);
  assert.deepEqual(b.events, ['B:start']);

  await app.close();

  assert.deepEqual(a.events, ['A:start', 'A:stop']);
  assert.deepEqual(b.events, ['B:start', 'B:stop']);
});

test('async onStart and onStop are awaited', async () => {
  const events: string[] = [];

  class AsyncModule extends AppModule {
    register(_router: Router): void {}

    override async onStart(): Promise<void> {
      await Promise.resolve();
      events.push('started');
    }

    override async onStop(): Promise<void> {
      await Promise.resolve();
      events.push('stopped');
    }
  }

  const { app } = await startApp((app) => {
    app.registerModule(new AsyncModule());
  });

  assert.deepEqual(events, ['started']);
  await app.close();
  assert.deepEqual(events, ['started', 'stopped']);
});

test('onStop is called after server stops accepting connections', async () => {
  const events: string[] = [];
  let serverListening = true;

  class ObservingModule extends AppModule {
    register(_router: Router): void {}

    override async onStop(): Promise<void> {
      events.push(`listening:${serverListening}`);
    }
  }

  const { app } = await startApp((app) => {
    app.registerModule(new ObservingModule());
  });

  const closePromise = app.close();
  serverListening = false;
  await closePromise;

  assert.deepEqual(events, ['listening:false']);
});
