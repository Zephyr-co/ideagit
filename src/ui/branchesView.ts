import * as vscode from 'vscode';
import { BranchService } from '../git/branchService';
import { RepositoryService } from '../git/repositoryService';
import { BranchInfo } from '../models';
import { BranchGroupNode, BranchNode, IdeaGitNode, MessageNode } from './nodes';

export class BranchesView implements vscode.TreeDataProvider<IdeaGitNode> {
  private readonly changeEmitter = new vscode.EventEmitter<IdeaGitNode | undefined | void>();
  private branches: BranchInfo[] = [];
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(
    private readonly repositories: RepositoryService,
    private readonly branchService: BranchService
  ) {
    this.repositories.onDidChangeRepositories(() => void this.refresh());
  }

  async refresh(): Promise<void> {
    const repository = this.repositories.selected;
    this.branches = repository ? await this.branchService.list(repository.rootPath) : [];
    this.changeEmitter.fire();
  }

  getTreeItem(element: IdeaGitNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: IdeaGitNode): IdeaGitNode[] {
    if (!this.repositories.selected) {
      return [new MessageNode('No selected repository')];
    }
    if (!element) {
      const localCount = this.branches.filter(branch => branch.type === 'local').length;
      const remoteCount = this.branches.filter(branch => branch.type === 'remote').length;
      return [
        new BranchGroupNode('Local Branches', 'local', localCount),
        new BranchGroupNode('Remote Branches', 'remote', remoteCount)
      ];
    }
    if (element instanceof BranchGroupNode) {
      return this.branches
        .filter(branch => branch.type === element.type)
        .map(branch => new BranchNode(branch));
    }
    return [];
  }
}
