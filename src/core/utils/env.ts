export function isDev(): boolean {
  return process.env['NODE_ENV'] === 'development';
}

export function isProd(): boolean {
  return process.env['NODE_ENV'] === 'production';
}

export function isTest(): boolean {
  return process.env['NODE_ENV'] === 'test';
}
