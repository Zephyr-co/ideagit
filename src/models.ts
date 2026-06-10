import * as vscode from 'vscode';

export type ChangeStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'ignored'
  | 'conflicted'
  | 'unknown';

export interface GitRepository {
  rootUri: vscode.Uri;
  rootPath: string;
  name: string;
  branch?: string;
  upstream?: string;
  ahead: number;
  behind: number;
  dirtyCount: number;
  conflictCount: number;
  operation?: GitOperationState;
}

export interface GitChange {
  repositoryRoot: string;
  path: string;
  originalPath?: string;
  indexStatus: string;
  workingTreeStatus: string;
  status: ChangeStatus;
  staged: boolean;
  untracked: boolean;
  ignored: boolean;
  conflicted: boolean;
}

export interface Changelist {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChangelistAssignment {
  changelistId: string;
  included: boolean;
  updatedAt: string;
}

export interface ChangelistState {
  version: 1;
  activeId: string;
  changelists: Changelist[];
  assignments: Record<string, ChangelistAssignment>;
}

export interface BranchInfo {
  name: string;
  type: 'local' | 'remote';
  current: boolean;
  upstream?: string;
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  subject: string;
  refs?: string;
}

export interface StashInfo {
  selector: string;
  branch?: string;
  message: string;
}

export interface ConflictInfo {
  repositoryRoot: string;
  path: string;
  operation: GitOperationState;
}

export type GitOperationKind = 'merge' | 'rebase' | 'cherry-pick' | 'revert' | 'none';

export interface GitOperationState {
  kind: GitOperationKind;
  detail?: string;
}

export interface GitResult {
  args: string[];
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
}

export interface CommitOptions {
  message: string;
  amend: boolean;
  skipHooks: boolean;
  signoff: boolean;
  author?: string;
  allowEmpty: boolean;
}

export interface PushTarget {
  remote: string;
  branch: string;
  setUpstream: boolean;
}

export interface OutgoingCommitRange {
  remoteRef?: string;
  localRef: string;
  commits: CommitInfo[];
}

export type ResetMode = 'soft' | 'mixed' | 'hard' | 'keep';

export function defaultChangelist(now = new Date().toISOString()): Changelist {
  return {
    id: 'default',
    name: 'Default Changelist',
    description: 'Default local changes',
    active: true,
    createdAt: now,
    updatedAt: now
  };
}
