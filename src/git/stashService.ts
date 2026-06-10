import * as vscode from 'vscode';
import { StashInfo } from '../models';
import { GitCliService } from './gitCliService';
import { parseStashList } from './gitParsers';

export class StashService {
  constructor(private readonly git: GitCliService) {}

  async list(repositoryRoot: string): Promise<StashInfo[]> {
    const result = await this.git.run(repositoryRoot, ['stash', 'list', '--format=%gd%x1f%gs%x1f%cr'], { allowNonZeroExit: true });
    return result.exitCode === 0 ? parseStashList(result.stdout) : [];
  }

  async stash(repositoryRoot: string, message?: string, includeUntracked = true, token?: vscode.CancellationToken): Promise<void> {
    const args = ['stash', 'push'];
    if (includeUntracked) {
      args.push('--include-untracked');
    }
    if (message?.trim()) {
      args.push('--message', message.trim());
    }
    await this.git.run(repositoryRoot, args, { cancellationToken: token });
  }

  async apply(repositoryRoot: string, selector: string, token?: vscode.CancellationToken): Promise<void> {
    await this.git.run(repositoryRoot, ['stash', 'apply', selector], { cancellationToken: token });
  }

  async pop(repositoryRoot: string, selector: string, token?: vscode.CancellationToken): Promise<void> {
    await this.git.run(repositoryRoot, ['stash', 'pop', selector], { cancellationToken: token });
  }

  async drop(repositoryRoot: string, selector: string, token?: vscode.CancellationToken): Promise<void> {
    await this.git.run(repositoryRoot, ['stash', 'drop', selector], { cancellationToken: token });
  }
}
