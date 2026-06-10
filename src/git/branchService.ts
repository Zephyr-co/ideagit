import * as vscode from 'vscode';
import { BranchInfo } from '../models';
import { GitCliService } from './gitCliService';
import { parseBranchList } from './gitParsers';

export class BranchService {
  constructor(private readonly git: GitCliService) {}

  async list(repositoryRoot: string): Promise<BranchInfo[]> {
    const result = await this.git.run(repositoryRoot, [
      'for-each-ref',
      '--format=%(HEAD)%09%(refname)%09%(refname:short)%09%(upstream:short)',
      'refs/heads',
      'refs/remotes'
    ]);
    return parseBranchList(result.stdout);
  }

  async checkout(repositoryRoot: string, branch: string, token?: vscode.CancellationToken): Promise<void> {
    this.assertSafeBranchName(branch);
    await this.git.run(repositoryRoot, ['switch', branch], { cancellationToken: token });
  }

  async checkoutRemote(repositoryRoot: string, remoteBranch: string, token?: vscode.CancellationToken): Promise<void> {
    this.assertSafeBranchName(remoteBranch);
    await this.git.run(repositoryRoot, ['switch', '--track', remoteBranch], { cancellationToken: token });
  }

  async create(repositoryRoot: string, branch: string, startPoint?: string, checkout = true, token?: vscode.CancellationToken): Promise<void> {
    this.assertSafeBranchName(branch);
    if (startPoint) {
      this.assertSafeBranchName(startPoint);
    }
    const args = checkout ? ['switch', '-c', branch] : ['branch', branch];
    if (startPoint) {
      args.push(startPoint);
    }
    await this.git.run(repositoryRoot, args, { cancellationToken: token });
  }

  async delete(repositoryRoot: string, branch: string, force: boolean, token?: vscode.CancellationToken): Promise<void> {
    this.assertSafeBranchName(branch);
    await this.git.run(repositoryRoot, ['branch', force ? '-D' : '-d', branch], { cancellationToken: token });
  }

  async unmergedCommits(repositoryRoot: string, branch: string): Promise<string[]> {
    this.assertSafeBranchName(branch);
    const result = await this.git.run(repositoryRoot, ['log', '--oneline', 'HEAD..' + branch], { allowNonZeroExit: true });
    return result.stdout.split(/\r?\n/).filter(Boolean);
  }

  async merge(repositoryRoot: string, branch: string, token?: vscode.CancellationToken): Promise<void> {
    this.assertSafeBranchName(branch);
    await this.git.run(repositoryRoot, ['merge', '--no-ff', branch], { cancellationToken: token });
  }

  async rebase(repositoryRoot: string, branch: string, token?: vscode.CancellationToken): Promise<void> {
    this.assertSafeBranchName(branch);
    await this.git.run(repositoryRoot, ['rebase', branch], { cancellationToken: token });
  }

  async compareWithCurrent(repositoryRoot: string, branch: string): Promise<string> {
    this.assertSafeBranchName(branch);
    const result = await this.git.run(repositoryRoot, ['log', '--left-right', '--graph', '--oneline', `HEAD...${branch}`], {
      allowNonZeroExit: true
    });
    return result.stdout.trim();
  }

  private assertSafeBranchName(branch: string): void {
    if (!branch.trim()) {
      throw new Error('Branch name is required.');
    }
    if (branch.startsWith('-') || /[\0\r\n]/.test(branch)) {
      throw new Error('Branch name is not safe to pass to Git.');
    }
  }
}
