import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { CommitOptions, GitChange } from '../models';
import { sanitizeFilename } from '../utils/pathUtils';
import { GitCliService } from './gitCliService';
import { StatusService } from './statusService';

export class CommitService {
  constructor(
    private readonly git: GitCliService,
    private readonly status: StatusService
  ) {}

  async commit(repositoryRoot: string, changes: GitChange[], options: CommitOptions, token?: vscode.CancellationToken): Promise<void> {
    const freshChanges = await this.status.getChanges(repositoryRoot, false);
    const freshPaths = new Set(freshChanges.map(change => change.path));
    const selected = changes.filter(change => freshPaths.has(change.path));
    if (!selected.length && !options.allowEmpty && !options.amend) {
      throw new Error('No selected changes are available to commit.');
    }

    const selectedPaths = selected.map(change => change.path);
    const messageFile = await this.writeCommitMessage(repositoryRoot, options.message);
    const tempIndex = await this.createTempIndex(repositoryRoot);
    const env = { GIT_INDEX_FILE: tempIndex.fsPath };
    let committed = false;

    try {
      const hasHead = await this.git.run(repositoryRoot, ['rev-parse', '--verify', 'HEAD'], {
        allowNonZeroExit: true,
        cancellationToken: token
      });
      if (hasHead.exitCode === 0) {
        await this.git.run(repositoryRoot, ['read-tree', 'HEAD'], { env, cancellationToken: token });
      }

      if (selectedPaths.length) {
        await this.git.run(repositoryRoot, ['add', '--', ...selectedPaths], { env, cancellationToken: token });
      }

      const args = ['commit', '--file', messageFile.fsPath];
      if (options.amend) {
        args.push('--amend');
      }
      if (options.skipHooks) {
        args.push('--no-verify');
      }
      if (options.signoff) {
        args.push('--signoff');
      }
      if (options.allowEmpty) {
        args.push('--allow-empty');
      }
      if (options.author?.trim()) {
        args.push('--author', options.author.trim());
      }
      await this.git.run(repositoryRoot, args, { env, cancellationToken: token });
      committed = true;
    } finally {
      if (committed && selectedPaths.length) {
        await this.git.run(repositoryRoot, ['restore', '--worktree', '--staged', '--source=HEAD', '--', ...selectedPaths], {
          allowNonZeroExit: true,
          cancellationToken: token
        });
      }
      await vscode.workspace.fs.delete(messageFile, { useTrash: false }).then(undefined, () => undefined);
      await vscode.workspace.fs.delete(tempIndex, { useTrash: false }).then(undefined, () => undefined);
    }
  }

  async lastCommitSummary(repositoryRoot: string): Promise<string | undefined> {
    const result = await this.git.run(repositoryRoot, ['log', '-1', '--format=%h %s'], { allowNonZeroExit: true });
    return result.exitCode === 0 ? result.stdout.trim() : undefined;
  }

  private async writeCommitMessage(repositoryRoot: string, message: string): Promise<vscode.Uri> {
    const dir = vscode.Uri.file(path.join(os.tmpdir(), 'ideagit'));
    await vscode.workspace.fs.createDirectory(dir);
    const fileName = `${Date.now()}-${sanitizeFilename(path.basename(repositoryRoot))}.txt`;
    const uri = vscode.Uri.joinPath(dir, fileName);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(message, 'utf8'));
    return uri;
  }

  private async createTempIndex(repositoryRoot: string): Promise<vscode.Uri> {
    const dir = vscode.Uri.file(path.join(os.tmpdir(), 'ideagit'));
    await vscode.workspace.fs.createDirectory(dir);
    const fileName = `${Date.now()}-${sanitizeFilename(path.basename(repositoryRoot))}.index`;
    return vscode.Uri.joinPath(dir, fileName);
  }
}
