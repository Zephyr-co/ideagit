import * as vscode from 'vscode';
import { RepositoryService } from '../git/repositoryService';
import { IdeaGitNode, MessageNode, RepositoryNode } from './nodes';

export class RepositoriesView implements vscode.TreeDataProvider<IdeaGitNode> {
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
    const repositories = this.repositories.all;
    if (!repositories.length) {
      return [new MessageNode('No Git repositories found')];
    }
    const selected = this.repositories.selected?.rootPath;
    return repositories.map(repository => new RepositoryNode(repository, repository.rootPath === selected));
  }
}
