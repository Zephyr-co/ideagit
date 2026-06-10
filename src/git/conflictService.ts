import * as vscode from 'vscode';
import { ConflictInfo } from '../models';
import { fromGitPath } from '../utils/pathUtils';
import { GitCliService } from './gitCliService';
import { RepositoryService } from './repositoryService';
import { StatusService } from './statusService';

export class ConflictService {
  constructor(
    private readonly git: GitCliService,
    private readonly status: StatusService,
    private readonly repositories: RepositoryService
  ) {}

  async list(repositoryRoot: string): Promise<ConflictInfo[]> {
    const [changes, operation] = await Promise.all([
      this.status.getChanges(repositoryRoot, false),
      this.repositories.detectOperation(repositoryRoot)
    ]);
    return changes
      .filter(change => change.conflicted)
      .map(change => ({ repositoryRoot, path: change.path, operation }));
  }

  async openMergeEditor(conflict: ConflictInfo): Promise<void> {
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fromGitPath(conflict.repositoryRoot, conflict.path)));
    await vscode.commands.executeCommand('git.openChange');
  }

  async markResolved(conflict: ConflictInfo, token?: vscode.CancellationToken): Promise<void> {
    await this.git.run(conflict.repositoryRoot, ['add', '--', conflict.path], { cancellationToken: token });
  }

  async abort(repositoryRoot: string, operationKind: string, token?: vscode.CancellationToken): Promise<void> {
    if (operationKind === 'merge') {
      await this.git.run(repositoryRoot, ['merge', '--abort'], { cancellationToken: token });
      return;
    }
    if (operationKind === 'rebase') {
      await this.git.run(repositoryRoot, ['rebase', '--abort'], { cancellationToken: token });
      return;
    }
    if (operationKind === 'cherry-pick') {
      await this.git.run(repositoryRoot, ['cherry-pick', '--abort'], { cancellationToken: token });
      return;
    }
    if (operationKind === 'revert') {
      await this.git.run(repositoryRoot, ['revert', '--abort'], { cancellationToken: token });
      return;
    }
    throw new Error('No abortable Git operation is in progress.');
  }
}
