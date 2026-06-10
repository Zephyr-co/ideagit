import * as vscode from 'vscode';
import { ConflictService } from '../git/conflictService';
import { RepositoryService } from '../git/repositoryService';
import { ConflictInfo } from '../models';
import { ConflictNode, IdeaGitNode, MessageNode } from './nodes';

export class ConflictsView implements vscode.TreeDataProvider<IdeaGitNode> {
  private readonly changeEmitter = new vscode.EventEmitter<IdeaGitNode | undefined | void>();
  private conflicts: ConflictInfo[] = [];
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(
    private readonly repositories: RepositoryService,
    private readonly conflictsService: ConflictService
  ) {
    this.repositories.onDidChangeRepositories(() => void this.refresh());
  }

  async refresh(): Promise<void> {
    const repository = this.repositories.selected;
    this.conflicts = repository ? await this.conflictsService.list(repository.rootPath) : [];
    this.changeEmitter.fire();
  }

  getTreeItem(element: IdeaGitNode): vscode.TreeItem {
    return element;
  }

  getChildren(): IdeaGitNode[] {
    if (!this.repositories.selected) {
      return [new MessageNode('No selected repository')];
    }
    return this.conflicts.length ? this.conflicts.map(conflict => new ConflictNode(conflict)) : [new MessageNode('No conflicts')];
  }
}
