import * as path from 'path';

export function normalizeRepositoryPath(value: string): string {
  return path.resolve(value);
}

export function toGitPath(repositoryRoot: string, absoluteOrRelativePath: string): string {
  const relative = path.isAbsolute(absoluteOrRelativePath)
    ? path.relative(repositoryRoot, absoluteOrRelativePath)
    : absoluteOrRelativePath;
  return relative.split(path.sep).join('/');
}

export function fromGitPath(repositoryRoot: string, gitPath: string): string {
  return path.join(repositoryRoot, ...gitPath.split('/'));
}

export function repositoryStorageKey(rootPath: string): string {
  const normalized = normalizeRepositoryPath(rootPath).toLowerCase();
  return Buffer.from(normalized, 'utf8').toString('base64url');
}

export function basename(value: string): string {
  return path.basename(value);
}

export function sanitizeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120) || 'item';
}
