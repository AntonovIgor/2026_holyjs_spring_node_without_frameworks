import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '../../src/core/config/ConfigService.js';
import { field } from '../../src/core/config/types.js';

function withEnv(vars: Record<string, string>, fn: () => void): void {
  const originals: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    originals[k] = process.env[k];
    process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, orig] of Object.entries(originals)) {
      if (orig !== undefined) process.env[k] = orig;
      else delete process.env[k];
    }
  }
}

test('reads string value from env', () => {
  withEnv({ APP_HOST: 'example.com' }, () => {
    const schema = { host: field({ env: 'APP_HOST', type: 'string' }) };
    const config = new ConfigService(schema);
    assert.equal(config.get('host'), 'example.com');
  });
});

test('coerces number from env string', () => {
  withEnv({ APP_PORT: '3000' }, () => {
    const schema = { port: field({ env: 'APP_PORT', type: 'number' }) };
    const config = new ConfigService(schema);
    assert.equal(config.get('port'), 3000);
    assert.equal(typeof config.get('port'), 'number');
  });
});

test('coerces boolean "true" from env', () => {
  withEnv({ APP_DEBUG: 'true' }, () => {
    const schema = { debug: field({ env: 'APP_DEBUG', type: 'boolean' }) };
    const config = new ConfigService(schema);
    assert.equal(config.get('debug'), true);
  });
});

test('coerces boolean "1" from env', () => {
  withEnv({ APP_DEBUG: '1' }, () => {
    const schema = { debug: field({ env: 'APP_DEBUG', type: 'boolean' }) };
    const config = new ConfigService(schema);
    assert.equal(config.get('debug'), true);
  });
});

test('coerces boolean "false" from env to false', () => {
  withEnv({ APP_DEBUG: 'false' }, () => {
    const schema = { debug: field({ env: 'APP_DEBUG', type: 'boolean' }) };
    const config = new ConfigService(schema);
    assert.equal(config.get('debug'), false);
  });
});

test('uses default value when env var is not set', () => {
  delete process.env['APP_TIMEOUT'];
  const schema = { timeout: field({ env: 'APP_TIMEOUT', type: 'number', default: 30 }) };
  const config = new ConfigService(schema);
  assert.equal(config.get('timeout'), 30);
});

test('env var takes priority over default', () => {
  withEnv({ APP_TIMEOUT: '60' }, () => {
    const schema = { timeout: field({ env: 'APP_TIMEOUT', type: 'number', default: 30 }) };
    const config = new ConfigService(schema);
    assert.equal(config.get('timeout'), 60);
  });
});

test('throws when required field is missing', () => {
  delete process.env['APP_SECRET'];
  const schema = { secret: field({ env: 'APP_SECRET', type: 'string' }) };
  assert.throws(
    () => new ConfigService(schema),
    (err: unknown) =>
      err instanceof Error && err.message.includes('APP_SECRET'),
  );
});

test('throws for invalid number in env', () => {
  withEnv({ APP_PORT: 'not-a-number' }, () => {
    const schema = { port: field({ env: 'APP_PORT', type: 'number' }) };
    assert.throws(
      () => new ConfigService(schema),
      (err: unknown) =>
        err instanceof Error && err.message.includes('port'),
    );
  });
});

test('get() throws for unknown path', () => {
  withEnv({ APP_HOST: 'localhost' }, () => {
    const schema = { host: field({ env: 'APP_HOST', type: 'string' }) };
    const config = new ConfigService(schema);
    assert.throws(
      // @ts-expect-error intentional unknown key
      () => config.get('unknown'),
      (err: unknown) => err instanceof Error,
    );
  });
});

test('nested schema: reads dot-notation paths', () => {
  withEnv({ DB_HOST: 'localhost', DB_PORT: '5432' }, () => {
    const schema = {
      db: {
        host: field({ env: 'DB_HOST', type: 'string' }),
        port: field({ env: 'DB_PORT', type: 'number' }),
      },
    };
    const config = new ConfigService(schema);
    assert.equal(config.get('db.host'), 'localhost');
    assert.equal(config.get('db.port'), 5432);
  });
});

test('nested schema: throws when nested required field is missing', () => {
  delete process.env['DB_PASSWORD'];
  const schema = {
    db: {
      password: field({ env: 'DB_PASSWORD', type: 'string' }),
    },
  };
  assert.throws(
    () => new ConfigService(schema),
    (err: unknown) =>
      err instanceof Error && err.message.includes('DB_PASSWORD'),
  );
});
