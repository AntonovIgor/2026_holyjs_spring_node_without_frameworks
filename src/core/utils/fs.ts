import { isAbsolute, relative, resolve, sep } from 'node:path';

export function resolveStaticFilePath(root: string, requestPath: string): string | null {
  const normalizedRequestPath =
    requestPath === '' || requestPath === '/'
      ? 'index.html'
      : requestPath.replace(/^\/+/, '');

  const filePath = resolve(root, normalizedRequestPath);
  const relativePath = relative(root, filePath);

  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    return null;
  }

  return filePath;
}
