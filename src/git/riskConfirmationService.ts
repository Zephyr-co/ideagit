import * as vscode from 'vscode';
import { GitChange, ResetMode } from '../models';

export interface RiskConfirmation {
  title: string;
  object: string;
  impact: string;
  recoverability: string;
  confirmLabel?: string;
  secondConfirm?: boolean;
  details?: string[];
}

export class RiskConfirmationService {
  async confirm(risk: RiskConfirmation): Promise<boolean> {
    const detail = [
      `Object: ${risk.object}`,
      `Impact: ${risk.impact}`,
      `Recoverability: ${risk.recoverability}`,
      ...(risk.details?.slice(0, 20) ?? [])
    ].join('\n');
    const confirmLabel = risk.confirmLabel ?? 'Continue';
    const choice = await vscode.window.showWarningMessage(risk.title, { modal: true, detail }, confirmLabel, 'Cancel');
    if (choice !== confirmLabel) {
      return false;
    }
    if (!risk.secondConfirm) {
      return true;
    }
    const typed = await vscode.window.showInputBox({
      title: `${risk.title} - second confirmation`,
      prompt: `Type ${confirmLabel} to continue.`,
      ignoreFocusOut: true
    });
    return typed === confirmLabel;
  }

  confirmRollback(changes: GitChange[]): Promise<boolean> {
    return this.confirm({
      title: 'Rollback local changes?',
      object: `${changes.length} file(s)`,
      impact: 'Selected uncommitted working tree changes will be discarded.',
      recoverability: 'Recoverable only from editor undo, backups, or Git if already committed elsewhere.',
      confirmLabel: 'Rollback',
      details: changes.map(change => change.path)
    });
  }

  confirmHardReset(target: string, changes: GitChange[]): Promise<boolean> {
    return this.confirm({
      title: 'Hard reset current branch?',
      object: target,
      impact: 'The branch and working tree will move to the selected revision. Local changes may be lost.',
      recoverability: 'Committed changes can usually be recovered from reflog. Uncommitted changes may be lost.',
      confirmLabel: 'Hard Reset',
      secondConfirm: true,
      details: changes.map(change => `${change.status}: ${change.path}`)
    });
  }

  confirmReset(mode: ResetMode, target: string, changes: GitChange[]): Promise<boolean> {
    if (mode === 'hard') {
      return this.confirmHardReset(target, changes);
    }
    return this.confirm({
      title: `Reset current branch (${mode})?`,
      object: target,
      impact: `Git reset --${mode} will move the current branch.`,
      recoverability: 'Committed changes can usually be recovered from reflog.',
      confirmLabel: 'Reset',
      details: changes.map(change => `${change.status}: ${change.path}`)
    });
  }

  confirmForcePush(remote: string, branch: string, commits: string[]): Promise<boolean> {
    return this.confirm({
      title: 'Force push with lease?',
      object: `${remote}/${branch}`,
      impact: 'Remote history may be rewritten if the remote still matches the known lease.',
      recoverability: 'Other collaborators may need to recover or rebase their work.',
      confirmLabel: 'Force Push With Lease',
      details: commits
    });
  }

  confirmDeleteBranch(branch: string, unmergedCommits: string[]): Promise<boolean> {
    return this.confirm({
      title: unmergedCommits.length ? 'Delete unmerged branch?' : 'Delete branch?',
      object: branch,
      impact: unmergedCommits.length
        ? 'The branch has commits not merged into the current branch.'
        : 'The branch reference will be removed locally.',
      recoverability: 'Deleted local branch tips can often be recovered from reflog if acted on quickly.',
      confirmLabel: unmergedCommits.length ? 'Delete Unmerged Branch' : 'Delete Branch',
      secondConfirm: unmergedCommits.length > 0,
      details: unmergedCommits
    });
  }

  confirmAbort(operation: string): Promise<boolean> {
    return this.confirm({
      title: `Abort ${operation}?`,
      object: operation,
      impact: 'Git will attempt to stop the in-progress operation and restore the previous state.',
      recoverability: 'Manual recovery may be needed if the working tree changed during conflict resolution.',
      confirmLabel: 'Abort'
    });
  }

  confirmDropStash(selector: string): Promise<boolean> {
    return this.confirm({
      title: 'Drop stash?',
      object: selector,
      impact: 'The selected stash entry will be deleted.',
      recoverability: 'Dropped stash entries are difficult to recover.',
      confirmLabel: 'Drop Stash'
    });
  }
}
