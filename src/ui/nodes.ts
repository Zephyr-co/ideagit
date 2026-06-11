import * as vscode from 'vscode';
import {
  BranchInfo,
  Changelist,
  CommitInfo,
  ConflictInfo,
  GitChange,
  GitRepository,
  StashInfo
} from '../models';
import { fromGitPath } from '../utils/pathUtils';

export type NodeKind =
  | 'repository'
  | 'repositoryGroup'
  | 'changelist'
  | 'changeGroup'
  | 'changeRepository'
  | 'changeDirectory'
  | 'change'
  | 'branchGroup'
  | 'branchLocal'
  | 'branchRemote'
  | 'commit'
  | 'commitDirectory'
  | 'commitFile'
  | 'syncAction'
  | 'stash'
  | 'conflict'
  | 'message';

export type ChangeCheckboxState = vscode.TreeItemCheckboxState | {
  readonly state: vscode.TreeItemCheckboxState;
  readonly tooltip?: string;
  readonly accessibilityInformation?: vscode.AccessibilityInformation;
};

export class IdeaGitNode extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    readonly kind: NodeKind,
    readonly payload?: unknown,
    contextValue?: string
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue ?? kind;
  }
}

export class RepositoryNode extends IdeaGitNode {
  constructor(readonly repository: GitRepository, selected: boolean) {
    super(repository.name, vscode.TreeItemCollapsibleState.None, 'repository', repository);
    this.description = `${repository.branch ?? 'HEAD'}${repository.upstream ? ` -> ${repository.upstream}` : ''}`;
    this.tooltip = `${repository.rootPath}\n${repository.dirtyCount} changes, ahead ${repository.ahead}, behind ${repository.behind}`;
    this.iconPath = new vscode.ThemeIcon(selected ? 'repo-force-push' : 'repo');
    this.command = {
      command: 'ideagit.selectRepository',
      title: 'Select Repository',
      arguments: [this]
    };
  }
}

export class MessageNode extends IdeaGitNode {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None, 'message');
    this.iconPath = new vscode.ThemeIcon('info');
  }
}

export class ChangelistNode extends IdeaGitNode {
  constructor(
    readonly changelist: Changelist,
    readonly count: number,
    readonly changes: GitChange[] = [],
    checkboxState?: ChangeCheckboxState
  ) {
    const baseLabel = changelistLabel(changelist);
    const visualLabel = `${changelist.active ? '●' : '○'} ${baseLabel}`;
    super(visualLabel, vscode.TreeItemCollapsibleState.Expanded, 'changelist', changelist);
    this.label = {
      label: visualLabel,
      highlights: changelist.active ? [[2, visualLabel.length]] : undefined
    };
    this.description = changelist.active
      ? `ACTIVE - ${countLabel(count)}`
      : `inactive - ${countLabel(count)}`;
    this.iconPath = new vscode.ThemeIcon(
      changelist.active ? 'circle-filled' : 'circle-large-outline',
      new vscode.ThemeColor(changelist.active ? 'gitDecoration.addedResourceForeground' : 'descriptionForeground')
    );
    this.tooltip = [
      changelist.active
        ? 'Active changelist. New changes are assigned here.'
        : 'Inactive changelist. Use Set Active Changelist to activate it.',
      changelist.description || changelist.name
    ].join('\n');
    this.accessibilityInformation = {
      label: `${baseLabel}, ${changelist.active ? 'active' : 'inactive'}, ${countLabel(count)}`
    };
    this.checkboxState = checkboxState;
  }
}

export class ChangeGroupNode extends IdeaGitNode {
  constructor(
    label: string,
    readonly changes: GitChange[],
    checkboxState?: ChangeCheckboxState,
    collapsibleState = vscode.TreeItemCollapsibleState.Expanded
  ) {
    super(label, collapsibleState, 'changeGroup', changes, 'group');
    this.description = countLabel(changes.length);
    this.iconPath = new vscode.ThemeIcon('list-tree');
    this.checkboxState = checkboxState;
  }
}

export class RepositoryChangesNode extends IdeaGitNode {
  constructor(
    readonly repository: GitRepository,
    readonly changes: GitChange[],
    checkboxState?: ChangeCheckboxState
  ) {
    super(repository.rootPath, vscode.TreeItemCollapsibleState.Expanded, 'changeRepository', repository, 'repositoryGroup');
    this.description = countLabel(changes.length);
    this.tooltip = repository.rootPath;
    this.iconPath = new vscode.ThemeIcon('folder');
    this.checkboxState = checkboxState;
  }
}

export class ChangeDirectoryNode extends IdeaGitNode {
  constructor(
    label: string,
    readonly pathPrefix: string,
    readonly changes: GitChange[],
    checkboxState?: ChangeCheckboxState
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed, 'changeDirectory', pathPrefix, 'directory');
    this.description = countLabel(changes.length);
    this.tooltip = pathPrefix;
    this.iconPath = new vscode.ThemeIcon('folder');
    this.checkboxState = checkboxState;
  }
}

export class ChangeNode extends IdeaGitNode {
  constructor(readonly change: GitChange, readonly included: boolean, label = change.path, checkboxState?: ChangeCheckboxState) {
    super(label, vscode.TreeItemCollapsibleState.None, 'change', change, included ? 'change included' : 'change excluded');
    this.resourceUri = vscode.Uri.file(fromGitPath(change.repositoryRoot, change.path));
    this.description = `${change.status}${included ? '' : ' - excluded'}`;
    this.tooltip = `${change.indexStatus}${change.workingTreeStatus} ${change.path}`;
    this.iconPath = changeIcon(change, included);
    this.checkboxState = checkboxState;
    this.command = {
      command: 'ideagit.showDiff',
      title: 'Show Diff',
      arguments: [this]
    };
  }
}

export class BranchGroupNode extends IdeaGitNode {
  constructor(label: string, readonly type: 'local' | 'remote', count: number) {
    super(label, vscode.TreeItemCollapsibleState.Expanded, 'branchGroup', type, type === 'local' ? 'branchGroupLocal' : 'branchGroupRemote');
    this.description = String(count);
    this.iconPath = new vscode.ThemeIcon('git-branch');
  }
}

export class BranchNode extends IdeaGitNode {
  constructor(readonly branch: BranchInfo) {
    super(branch.name, vscode.TreeItemCollapsibleState.None, branch.type === 'local' ? 'branchLocal' : 'branchRemote', branch, branch.type === 'local' ? 'branchLocal branch' : 'branchRemote branch');
    this.description = branch.current ? 'current' : branch.upstream;
    this.iconPath = new vscode.ThemeIcon(branch.current ? 'git-branch' : 'repo-forked');
  }
}

export class CommitNode extends IdeaGitNode {
  constructor(readonly commit: CommitInfo) {
    super(commit.subject || commit.shortHash, vscode.TreeItemCollapsibleState.Collapsed, 'commit', commit);
    this.id = `commit:${commit.hash}`;
    this.description = `${commit.shortHash} - ${commit.author} - ${commit.date}`;
    this.tooltip = `${commit.hash}\n${commit.refs ?? ''}\n${commit.subject}\n\nClick to show committed files.`;
    this.iconPath = new vscode.ThemeIcon('git-commit');
    this.command = {
      command: 'ideagit.expandCommitFiles',
      title: 'Show Committed Files',
      arguments: [this]
    };
  }
}

export class CommitDirectoryNode extends IdeaGitNode {
  constructor(
    readonly repositoryRoot: string,
    readonly commit: CommitInfo,
    label: string,
    readonly pathPrefix: string,
    readonly files: string[]
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed, 'commitDirectory', { repositoryRoot, commit, pathPrefix, files }, 'commitDirectory');
    this.id = `commit:${commit.hash}:dir:${pathPrefix}`;
    this.description = countLabel(files.length);
    this.tooltip = pathPrefix;
    this.iconPath = new vscode.ThemeIcon('folder');
  }
}

export class CommitFileNode extends IdeaGitNode {
  constructor(readonly repositoryRoot: string, readonly commit: CommitInfo, readonly filePath: string, label = filePath) {
    super(label, vscode.TreeItemCollapsibleState.None, 'commitFile', { repositoryRoot, commit, path: filePath }, 'commitFile');
    this.id = `commit:${commit.hash}:file:${filePath}`;
    this.resourceUri = vscode.Uri.file(fromGitPath(repositoryRoot, filePath));
    this.tooltip = filePath;
    this.iconPath = vscode.ThemeIcon.File;
    this.command = {
      command: 'ideagit.showCommitFileDiff',
      title: 'Show Commit File Diff',
      arguments: [this]
    };
  }
}

export class SyncActionNode extends IdeaGitNode {
  constructor(label: string, command: string, description?: string) {
    super(label, vscode.TreeItemCollapsibleState.None, 'syncAction', command);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon(command.includes('push') ? 'repo-push' : command.includes('pull') ? 'repo-pull' : 'sync');
    this.command = { command, title: label };
  }
}

export class StashNode extends IdeaGitNode {
  constructor(readonly stash: StashInfo) {
    super(stash.selector, vscode.TreeItemCollapsibleState.None, 'stash', stash);
    this.description = stash.branch;
    this.tooltip = stash.message;
    this.iconPath = new vscode.ThemeIcon('archive');
  }
}

export class ConflictNode extends IdeaGitNode {
  constructor(readonly conflict: ConflictInfo) {
    super(conflict.path, vscode.TreeItemCollapsibleState.None, 'conflict', conflict);
    this.description = conflict.operation.kind;
    this.resourceUri = vscode.Uri.file(fromGitPath(conflict.repositoryRoot, conflict.path));
    this.iconPath = new vscode.ThemeIcon('warning');
    this.command = {
      command: 'ideagit.resolveConflicts',
      title: 'Resolve Conflict',
      arguments: [this]
    };
  }
}

export function nodePayload<T>(value: unknown): T | undefined {
  if (value instanceof IdeaGitNode) {
    return value.payload as T | undefined;
  }
  return value as T | undefined;
}

function changeIcon(change: GitChange, included: boolean): vscode.ThemeIcon {
  if (change.ignored) {
    return new vscode.ThemeIcon('eye-closed', new vscode.ThemeColor('descriptionForeground'));
  }
  switch (change.status) {
    case 'added':
    case 'untracked':
      if (!included) {
        return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('descriptionForeground'));
      }
      return new vscode.ThemeIcon('diff-added', new vscode.ThemeColor('gitDecoration.addedResourceForeground'));
    case 'deleted':
      if (!included) {
        return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('descriptionForeground'));
      }
      return new vscode.ThemeIcon('diff-removed', new vscode.ThemeColor('gitDecoration.deletedResourceForeground'));
    case 'renamed':
    case 'copied':
      if (!included) {
        return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('descriptionForeground'));
      }
      return new vscode.ThemeIcon('diff-renamed', new vscode.ThemeColor('gitDecoration.renamedResourceForeground'));
    case 'conflicted':
      if (!included) {
        return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('descriptionForeground'));
      }
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('gitDecoration.conflictingResourceForeground'));
    case 'modified':
      if (!included) {
        return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('descriptionForeground'));
      }
      return new vscode.ThemeIcon('diff-modified', new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'));
    default:
      if (!included) {
        return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('descriptionForeground'));
      }
      return new vscode.ThemeIcon('diff', new vscode.ThemeColor('descriptionForeground'));
  }
}

function changelistLabel(changelist: Changelist): string {
  if (changelist.id === 'default' && changelist.name === 'Default Changelist') {
    return 'Changes';
  }
  return changelist.name;
}

function countLabel(count: number): string {
  return `${count} file${count === 1 ? '' : 's'}`;
}
