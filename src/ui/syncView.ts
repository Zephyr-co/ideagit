import * as vscode from 'vscode';
import { RepositoryService } from '../git/repositoryService';
import { IdeaGitNode, MessageNode, SyncActionNode } from './nodes';

export class SyncView implements vscode.TreeDataProvider<IdeaGitNode> {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(private readonly repositories: RepositoryService) {
    this.repositories.onDidChangeRepositories(() => this.refresh());
  }

  refresh(): void {
    this.changeEmitter.fire();
  }

  getTreeItem(element: IdeaGitNode): vscode.TreeItem {
    return element;
  }

  getChildren(): IdeaGitNode[] {
    const repository = this.repositories.selected;
    if (!repository) {
      return [new MessageNode('No selected repository')];
    }
    return [
      new MessageNode(`${repository.name}:${repository.branch ?? 'HEAD'} - ahead ${repository.ahead} / behind ${repository.behind}`),
      new SyncActionNode('Fetch', 'ideagit.fetch'),
      new SyncActionNode('Pull', 'ideagit.pull'),
      new SyncActionNode('Update Project', 'ideagit.updateProject'),
      new SyncActionNode('Push', 'ideagit.push', repository.ahead ? `${repository.ahead} outgoing` : undefined),
      new SyncActionNode('Force Push With Lease', 'ideagit.forcePushWithLease')
    ];
  }
}
