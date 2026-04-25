import { Application, type ApplicationOptions } from '../../src/core/http/Application.js';
import type { Logger } from '../../src/core/logger/Logger.js';

const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
};

export interface TestApp {
  app: Application;
  port: number;
  url: (path: string) => string;
}

export async function startApp(
  setup: (app: Application) => void,
  options: Omit<ApplicationOptions, 'logger'> = {},
): Promise<TestApp> {
  const app = new Application({ ...options, logger: silentLogger });
  setup(app);
  await app.listen(0);
  const port = app.address().port;
  return {
    app,
    port,
    url: (path) => `http://localhost:${port}${path}`,
  };
}
