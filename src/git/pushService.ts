import * as vscode from 'vscode';
import { BranchInfo, CommitInfo, OutgoingCommitRange, PushTarget } from '../models';
import { GitCliService } from './gitCliService';
import { parseCommitLog } from './gitParsers';

export class PushService {
  constructor(private readonly git: GitCliService) {}

  async defaultTarget(repositoryRoot: string, branch?: string): Promise<PushTarget> {
    const remoteResult = await this.git.run(repositoryRoot, ['config', '--get', `branch.${branch ?? ''}.remote`], {
      allowNonZeroExit: true
    });
    const mergeResult = await this.git.run(repositoryRoot, ['config', '--get', `branch.${branch ?? ''}.merge`], {
      allowNonZeroExit: true
    });
    const remote = remoteResult.exitCode === 0 && remoteResult.stdout.trim() ? remoteResult.stdout.trim() : 'origin';
    const remoteBranch = mergeResult.exitCode === 0 && mergeResult.stdout.trim()
      ? mergeResult.stdout.trim().replace(/^refs\/heads\//, '')
      : branch ?? 'HEAD';
    return { remote, branch: remoteBranch, setUpstream: remoteResult.exitCode !== 0 };
  }

  async outgoing(repositoryRoot: string, branch: string, target: PushTarget): Promise<OutgoingCommitRange> {
    this.assertSafeTarget(target);
    const remoteRef = `${target.remote}/${target.branch}`;
    const remoteExists = await this.git.run(repositoryRoot, ['rev-parse', '--verify', remoteRef], { allowNonZeroExit: true });
    const range = remoteExists.exitCode === 0 ? `${remoteRef}..HEAD` : 'HEAD';
    const result = await this.git.run(repositoryRoot, [
      'log',
      '--date=short',
      '--format=%H%x1f%h%x1f%an%x1f%ad%x1f%D%x1f%s',
      range
    ], { allowNonZeroExit: true });
    const commits = result.exitCode === 0 ? parseCommitLog(result.stdout) : [];
    return {
      remoteRef: remoteExists.exitCode === 0 ? remoteRef : undefined,
      localRef: branch,
      commits
    };
  }

  async push(repositoryRoot: string, target: PushTarget, token?: vscode.CancellationToken): Promise<void> {
    this.assertSafeTarget(target);
    const args = ['push'];
    if (target.setUpstream) {
      args.push('--set-upstream');
    }
    args.push(target.remote, `HEAD:${target.branch}`);
    await this.git.run(repositoryRoot, args, { cancellationToken: token });
  }

  async forcePushWithLease(repositoryRoot: string, target: PushTarget, token?: vscode.CancellationToken): Promise<void> {
    this.assertSafeTarget(target);
    await this.git.run(repositoryRoot, ['push', '--force-with-lease', target.remote, `HEAD:${target.branch}`], {
      cancellationToken: token
    });
  }

  async pushTags(repositoryRoot: string, target: PushTarget, token?: vscode.CancellationToken): Promise<void> {
    this.assertSafeTarget(target);
    await this.git.run(repositoryRoot, ['push', target.remote, '--tags'], { cancellationToken: token });
  }

  async remotes(repositoryRoot: string): Promise<string[]> {
    const result = await this.git.run(repositoryRoot, ['remote']);
    return result.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  }

  formatOutgoing(commits: CommitInfo[]): string[] {
    return commits.map(commit => `${commit.shortHash} ${commit.subject}`);
  }

  private assertSafeTarget(target: PushTarget): void {
    if (!target.remote.trim() || !target.branch.trim()) {
      throw new Error('Remote and branch are required.');
    }
    if (target.remote.startsWith('-') || target.branch.startsWith('-') || /[\0\r\n]/.test(`${target.remote}\n${target.branch}`)) {
      throw new Error('Push target is not safe to pass to Git.');
    }
  }
}
