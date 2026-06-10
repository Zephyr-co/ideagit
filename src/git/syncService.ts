import * as vscode from 'vscode';
import { GitCliService } from './gitCliService';

export class SyncService {
  constructor(private readonly git: GitCliService) {}

  async fetch(repositoryRoot: string, remote?: string, token?: vscode.CancellationToken): Promise<void> {
    const args = remote ? ['fetch', remote, '--prune'] : ['fetch', '--all', '--prune'];
    await this.git.run(repositoryRoot, args, { cancellationToken: token });
  }

  async pull(repositoryRoot: string, token?: vscode.CancellationToken): Promise<void> {
    const strategy = vscode.workspace.getConfiguration('ideagit').get<string>('pullStrategy', 'merge');
    const args = ['pull'];
    if (strategy === 'rebase') {
      args.push('--rebase');
    } else if (strategy === 'ff-only') {
      args.push('--ff-only');
    }
    await this.git.run(repositoryRoot, args, { cancellationToken: token });
  }

  async pullRebase(repositoryRoot: string, token?: vscode.CancellationToken): Promise<void> {
    await this.git.run(repositoryRoot, ['pull', '--rebase'], { cancellationToken: token });
  }

  async updateProject(repositoryRoot: string, token?: vscode.CancellationToken): Promise<void> {
    await this.fetch(repositoryRoot, undefined, token);
    await this.pull(repositoryRoot, token);
  }
}
