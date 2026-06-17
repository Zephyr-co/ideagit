import * as vscode from 'vscode';
import { RepositoryService } from '../git/repositoryService';
import { StatusService } from '../git/statusService';
import { GitChange } from '../models';
import { ChangelistService } from '../state/changelistService';
import {
  ChangeDirectoryNode,
  ChangeGroupNode,
  ChangeNode,
  ChangelistNode,
  IdeaGitNode,
  MessageNode,
  RepositoryChangesNode
} from './nodes';

interface ChangeTreeDirectory {
  name: string;
  pathPrefix: string;
  children: Map<string, ChangeTreeDirectory>;
  changes: GitChange[];
  files: GitChange[];
}

const checked = vscode.TreeItemCheckboxState.Checked;
const unchecked = vscode.TreeItemCheckboxState.Unchecked;

export class LocalChangesView implements vscode.TreeDataProvider<IdeaGitNode> {
  private readonly changeEmitter = new vscode.EventEmitter<IdeaGitNode | undefined | void>();
  private changes: GitChange[] = [];
  private checkboxHandler?: () => void;
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(
    private readonly repositories: RepositoryService,
    private readonly status: StatusService,
    private readonly changelists: ChangelistService
  ) {
    this.repositories.onDidChangeRepositories(() => void this.refresh());
  }

  onDidChangeIncluded(handler: () => void): void {
    this.checkboxHandler = handler;
  }

  async refresh(): Promise<void> {
    const repository = this.repositories.selected;
    if (!repository) {
      this.changes = [];
      this.changeEmitter.fire();
      return;
    }
    this.changes = await this.status.getChanges(repository.rootPath);
    this.changelists.pruneMissing(repository.rootPath, this.changes);
    this.changeEmitter.fire();
  }

  getSelectedIncludedChanges(): GitChange[] {
    const repository = this.repositories.selected;
    if (!repository) {
      return [];
    }
    return this.changes.filter(change => !change.ignored && this.changelists.isIncluded(repository.rootPath, change));
  }

  getActiveIncludedChanges(): GitChange[] {
    const repository = this.repositories.selected;
    if (!repository) {
      return [];
    }
    const state = this.changelists.getState(repository.rootPath);
    return this.changes.filter(change => {
      const assignment = this.changelists.getAssignment(repository.rootPath, change);
      return assignment.changelistId === state.activeId && assignment.included && !change.ignored;
    });
  }

  getTreeItem(element: IdeaGitNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: IdeaGitNode): IdeaGitNode[] {
    const repository = this.repositories.selected;
    if (!repository) {
      return [new MessageNode('No selected repository')];
    }
    if (!element) {
      const state = this.changelists.getState(repository.rootPath);
      const versioned = this.versionedChanges();
      const conflicted = this.conflictedChanges();
      const nonConflictedVersioned = versioned.filter(change => !change.conflicted);
      const nodes: IdeaGitNode[] = [...state.changelists]
        .sort(compareChangelists)
        .map(changelist => {
          const changes = nonConflictedVersioned.filter(
            change => this.changelists.getChangelistForChange(repository.rootPath, change).id === changelist.id
          );
          if (!changes.length && changelist.id === 'default' && (!changelist.active || nonConflictedVersioned.length === 0)) {
            return undefined;
          }
          return new ChangelistNode(changelist, changes.length, changes, this.checkboxStateForChanges(changes));
        })
        .filter((node): node is ChangelistNode => Boolean(node));

      if (conflicted.length) {
        nodes.unshift(new ChangeGroupNode(
          'Conflicts',
          conflicted,
          this.checkboxStateForChanges(conflicted),
          vscode.TreeItemCollapsibleState.Expanded,
          'conflictGroup'
        ));
      }

      const unversioned = this.unversionedChanges();
      if (unversioned.length) {
        nodes.push(new ChangeGroupNode('Unversioned Files', unversioned, this.checkboxStateForChanges(unversioned), vscode.TreeItemCollapsibleState.Collapsed));
      }

      const ignored = this.ignoredChanges();
      if (ignored.length) {
        nodes.push(new ChangeGroupNode('Ignored Files', ignored, undefined, vscode.TreeItemCollapsibleState.Collapsed));
      }

      return nodes.length ? nodes : [new MessageNode('Working tree clean')];
    }
    if (element instanceof ChangelistNode) {
      if (!element.changes.length) {
        return [];
      }
      return [new RepositoryChangesNode(repository, element.changes, this.checkboxStateForChanges(element.changes))];
    }
    if (element instanceof ChangeGroupNode) {
      return [new RepositoryChangesNode(repository, element.changes, element.changes.some(change => change.ignored) ? undefined : this.checkboxStateForChanges(element.changes))];
    }
    if (element instanceof RepositoryChangesNode) {
      return this.nodesForChanges(element.changes);
    }
    if (element instanceof ChangeDirectoryNode) {
      return this.nodesForChanges(element.changes, element.pathPrefix);
    }
    return [];
  }

  async updateIncludedFromCheckbox(items: ReadonlyArray<[IdeaGitNode, vscode.TreeItemCheckboxState]>): Promise<void> {
    const repository = this.repositories.selected;
    if (!repository) {
      return;
    }
    const changedGroups = new Map<boolean, GitChange[]>();

    for (const [node, state] of items) {
      const changes = this.checkboxChangesForNode(node).filter(change => !change.ignored);
      if (!changes.length) {
        continue;
      }
      const shouldInclude = state === checked;
      const bucket = changedGroups.get(shouldInclude) ?? [];
      bucket.push(...changes);
      changedGroups.set(shouldInclude, bucket);
    }

    for (const [shouldInclude, changes] of changedGroups) {
      await this.changelists.setIncludedMany(repository.rootPath, this.uniqueChanges(changes), shouldInclude);
    }

    if (changedGroups.size) {
      this.changeEmitter.fire();
      this.checkboxHandler?.();
    }
  }

  private versionedChanges(): GitChange[] {
    return this.changes.filter(change => !change.untracked && !change.ignored);
  }

  private conflictedChanges(): GitChange[] {
    return this.changes.filter(change => change.conflicted && !change.ignored);
  }

  private unversionedChanges(): GitChange[] {
    return this.changes.filter(change => change.untracked);
  }

  private ignoredChanges(): GitChange[] {
    return this.changes.filter(change => change.ignored);
  }

  private nodesForChanges(changes: GitChange[], prefix = ''): IdeaGitNode[] {
    const directory = this.buildTree(changes, prefix);
    const nodes: IdeaGitNode[] = [];

    for (const child of [...directory.children.values()].sort(compareDirectories)) {
      nodes.push(new ChangeDirectoryNode(child.name, child.pathPrefix, child.changes, this.checkboxStateForChanges(child.changes)));
    }

    for (const change of directory.files.sort(compareChanges)) {
      const label = change.path.slice(prefix.length).replace(/^\//, '') || change.path;
      nodes.push(new ChangeNode(change, this.changelists.isIncluded(change.repositoryRoot, change), label, change.ignored ? undefined : this.checkboxStateForChanges([change])));
    }

    return nodes;
  }

  private buildTree(changes: GitChange[], prefix: string): ChangeTreeDirectory {
    const root: ChangeTreeDirectory = {
      name: '',
      pathPrefix: prefix,
      children: new Map(),
      changes: [],
      files: []
    };

    for (const change of changes) {
      root.changes.push(change);
      const relativePath = prefix ? change.path.slice(prefix.length).replace(/^\//, '') : change.path;
      const segments = relativePath.split('/').filter(Boolean);
      if (segments.length <= 1) {
        root.files.push(change);
        continue;
      }

      let current = root;
      let currentPrefix = prefix;
      for (const segment of segments.slice(0, -1)) {
        currentPrefix = currentPrefix ? `${currentPrefix}/${segment}` : segment;
        let child = current.children.get(segment);
        if (!child) {
          child = {
            name: segment,
            pathPrefix: currentPrefix,
            children: new Map(),
            changes: [],
            files: []
          };
          current.children.set(segment, child);
        }
        child.changes.push(change);
        current = child;
      }
      current.files.push(change);
    }

    return this.compactDirectories(root);
  }

  private compactDirectories(directory: ChangeTreeDirectory): ChangeTreeDirectory {
    for (const [name, child] of [...directory.children]) {
      const compacted = this.compactDirectories(child);
      directory.children.set(name, compacted);
    }

    if (directory.name) {
      while (directory.files.length === 0 && directory.children.size === 1) {
        const onlyChild = [...directory.children.values()][0];
        directory.name = `${directory.name}/${onlyChild.name}`;
        directory.pathPrefix = onlyChild.pathPrefix;
        directory.children = onlyChild.children;
        directory.changes = onlyChild.changes;
        directory.files = onlyChild.files;
      }
    }

    return directory;
  }

  private checkboxStateForChanges(changes: GitChange[]) {
    const selectable = changes.filter(change => !change.ignored);
    if (!selectable.length) {
      return undefined;
    }
    const included = selectable.filter(change => this.changelists.isIncluded(change.repositoryRoot, change)).length;
    return {
      state: included === selectable.length ? checked : unchecked,
      tooltip: included === selectable.length
        ? 'Included in commit'
        : included === 0
          ? 'Excluded from commit'
          : `${included} of ${selectable.length} included - check to include all`
    };
  }

  private checkboxChangesForNode(node: IdeaGitNode): GitChange[] {
    if (node instanceof ChangeNode) {
      return [node.change];
    }
    if (
      node instanceof ChangelistNode ||
      node instanceof ChangeGroupNode ||
      node instanceof RepositoryChangesNode ||
      node instanceof ChangeDirectoryNode
    ) {
      return node.changes;
    }
    return [];
  }

  private uniqueChanges(changes: GitChange[]): GitChange[] {
    const seen = new Set<string>();
    return changes.filter(change => {
      if (seen.has(change.path)) {
        return false;
      }
      seen.add(change.path);
      return true;
    });
  }
}

function compareDirectories(a: ChangeTreeDirectory, b: ChangeTreeDirectory): number {
  return a.name.localeCompare(b.name);
}

function compareChangelists(a: { active: boolean }, b: { active: boolean }): number {
  if (a.active === b.active) {
    return 0;
  }
  return a.active ? -1 : 1;
}

function compareChanges(a: GitChange, b: GitChange): number {
  return a.path.localeCompare(b.path);
}
