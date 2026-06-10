import * as vscode from 'vscode';
import { CommitInfo, ResetMode } from '../models';
import { GitCliService } from './gitCliService';
import { parseCommitLog } from './gitParsers';

export class LogService {
  constructor(private readonly git: GitCliService) {}

  async list(repositoryRoot: string, query?: string): Promise<CommitInfo[]> {
    const pageSize = vscode.workspace.getConfiguration('ideagit').get<number>('logPageSize', 80);
    const args = [
      'log',
      `--max-count=${pageSize}`,
      '--date=short',
      '--decorate=short',
      '--format=%H%x1f%h%x1f%an%x1f%ad%x1f%D%x1f%s'
    ];
    if (query?.trim()) {
      args.push('--grep', query.trim(), '--all-match');
    }
    const result = await this.git.run(repositoryRoot, args, { allowNonZeroExit: true });
    return result.exitCode === 0 ? parseCommitLog(result.stdout) : [];
  }

  async details(repositoryRoot: string, hash: string): Promise<string> {
    const result = await this.git.run(repositoryRoot, ['show', '--stat', '--decorate=short', '--format=fuller', hash]);
    return result.stdout;
  }

  async files(repositoryRoot: string, hash: string): Promise<string[]> {
    const result = await this.git.run(repositoryRoot, ['show', '--name-only', '--format=', hash], { allowNonZeroExit: true });
    return result.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  }

  async cherryPick(repositoryRoot: string, hash: string, token?: vscode.CancellationToken): Promise<void> {
    await this.git.run(repositoryRoot, ['cherry-pick', hash], { cancellationToken: token });
  }

  async revert(repositoryRoot: string, hash: string, token?: vscode.CancellationToken): Promise<void> {
    await this.git.run(repositoryRoot, ['revert', hash], { cancellationToken: token });
  }

  async reset(repositoryRoot: string, hash: string, mode: ResetMode, token?: vscode.CancellationToken): Promise<void> {
    await this.git.run(repositoryRoot, ['reset', `--${mode}`, hash], { cancellationToken: token });
  }
}
