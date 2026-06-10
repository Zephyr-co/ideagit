import * as vscode from 'vscode';
import { LogService } from '../git/logService';
import { RepositoryService } from '../git/repositoryService';
import { CommitInfo } from '../models';
import { CommitNode, IdeaGitNode, MessageNode } from './nodes';

export class LogView implements vscode.TreeDataProvider<IdeaGitNode> {
  private readonly changeEmitter = new vscode.EventEmitter<IdeaGitNode | undefined | void>();
  private commits: CommitInfo[] = [];
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(
    private readonly repositories: RepositoryService,
    private readonly logService: LogService
  ) {
    this.repositories.onDidChangeRepositories(() => void this.refresh());
  }

  async refresh(query?: string): Promise<void> {
    const repository = this.repositories.selected;
    this.commits = repository ? await this.logService.list(repository.rootPath, query) : [];
    this.changeEmitter.fire();
  }

  getTreeItem(element: IdeaGitNode): vscode.TreeItem {
    return element;
  }

  getChildren(): IdeaGitNode[] {
    if (!this.repositories.selected) {
      return [new MessageNode('No selected repository')];
    }
    return this.commits.length ? this.commits.map(commit => new CommitNode(commit)) : [new MessageNode('No commits found')];
  }
}
