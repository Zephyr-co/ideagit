import * as vscode from 'vscode';
import { RepositoryService } from '../git/repositoryService';
import { StashService } from '../git/stashService';
import { StashInfo } from '../models';
import { IdeaGitNode, MessageNode, StashNode } from './nodes';

export class StashView implements vscode.TreeDataProvider<IdeaGitNode> {
  private readonly changeEmitter = new vscode.EventEmitter<IdeaGitNode | undefined | void>();
  private stashes: StashInfo[] = [];
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(
    private readonly repositories: RepositoryService,
    private readonly stashService: StashService
  ) {
    this.repositories.onDidChangeRepositories(() => void this.refresh());
  }

  async refresh(): Promise<void> {
    const repository = this.repositories.selected;
    this.stashes = repository ? await this.stashService.list(repository.rootPath) : [];
    this.changeEmitter.fire();
  }

  getTreeItem(element: IdeaGitNode): vscode.TreeItem {
    return element;
  }

  getChildren(): IdeaGitNode[] {
    if (!this.repositories.selected) {
      return [new MessageNode('No selected repository')];
    }
    return this.stashes.length ? this.stashes.map(stash => new StashNode(stash)) : [new MessageNode('No stashes')];
  }
}
