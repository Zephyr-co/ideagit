import * as vscode from 'vscode';
import { BranchService } from '../git/branchService';
import { CommitService } from '../git/commitService';
import { ConflictService } from '../git/conflictService';
import { GitCliService, GitCliError } from '../git/gitCliService';
import { LogService } from '../git/logService';
import { PushService } from '../git/pushService';
import { RepositoryService } from '../git/repositoryService';
import { RiskConfirmationService } from '../git/riskConfirmationService';
import { StashService } from '../git/stashService';
import { StatusService } from '../git/statusService';
import { SyncService } from '../git/syncService';
import { BranchInfo, CommitInfo, CommitOptions, ConflictInfo, GitChange, PushTarget, ResetMode, StashInfo } from '../models';
import { ChangelistService } from '../state/changelistService';
import { fromGitPath } from '../utils/pathUtils';
import { Output } from '../utils/output';
import { LocalChangesView } from '../ui/localChangesView';
import {
  BranchNode,
  ChangeNode,
  ChangelistNode,
  CommitNode,
  ConflictNode,
  IdeaGitNode,
  RepositoryNode,
  StashNode,
  nodePayload
} from '../ui/nodes';
import { PushPreviewWebviewProvider } from '../ui/pushPreviewWebview';
import { CommitWebviewProvider } from '../ui/commitWebview';

export interface CommandRegistryDependencies {
  output: Output;
  git: GitCliService;
  repositories: RepositoryService;
  status: StatusService;
  changelists: ChangelistService;
  localChanges: LocalChangesView;
  commit: CommitService;
  push: PushService;
  branch: BranchService;
  log: LogService;
  sync: SyncService;
  conflicts: ConflictService;
  stash: StashService;
  risk: RiskConfirmationService;
  commitWebview: CommitWebviewProvider;
  pushPreview: PushPreviewWebviewProvider;
  refreshAll: () => Promise<void>;
}

export class CommandRegistry {
  constructor(private readonly deps: CommandRegistryDependencies) {}

  register(context: vscode.ExtensionContext): void {
    const register = (command: string, callback: (...args: unknown[]) => unknown) => {
      context.subscriptions.push(vscode.commands.registerCommand(command, (...args) => this.runSafely(() => callback(...args))));
    };

    register('ideagit.refresh', () => this.deps.refreshAll());
    register('ideagit.addRepository', () => this.addRepository());
    register('ideagit.initRepository', () => this.initRepository());
    register('ideagit.cloneRepository', () => this.cloneRepository());
    register('ideagit.selectRepository', node => this.selectRepository(node));
    register('ideagit.showLocalChanges', () => vscode.commands.executeCommand('ideagit.localChanges.focus'));
    register('ideagit.showLog', () => vscode.commands.executeCommand('ideagit.log.focus'));
    register('ideagit.createChangelist', () => this.createChangelist());
    register('ideagit.renameChangelist', node => this.renameChangelist(node));
    register('ideagit.deleteChangelist', node => this.deleteChangelist(node));
    register('ideagit.setActiveChangelist', node => this.setActiveChangelist(node));
    register('ideagit.moveToChangelist', node => this.moveToChangelist(node));
    register('ideagit.toggleIncluded', node => this.toggleIncluded(node));
    register('ideagit.showDiff', node => this.showDiff(node));
    register('ideagit.openFile', node => this.openFile(node));
    register('ideagit.revealFile', node => this.revealFile(node));
    register('ideagit.rollback', node => this.rollback(node));
    register('ideagit.commit', () => this.commitInteractive(false));
    register('ideagit.commitAndPush', () => this.commitInteractive(true));
    register('ideagit.commitFromWebview', message => this.commitFromWebview(message, false));
    register('ideagit.commitAndPushFromWebview', message => this.commitFromWebview(message, true));
    register('ideagit.push', () => this.pushInteractive(false));
    register('ideagit.forcePushWithLease', () => this.pushInteractive(true));
    register('ideagit.pushFromWebview', message => this.pushFromWebview(message, false));
    register('ideagit.forcePushFromWebview', message => this.pushFromWebview(message, true));
    register('ideagit.fetch', () => this.fetch());
    register('ideagit.pull', () => this.pull());
    register('ideagit.pullRebase', () => this.pull(true));
    register('ideagit.updateProject', () => this.updateProject());
    register('ideagit.checkoutBranch', node => this.checkoutBranch(node));
    register('ideagit.createBranch', () => this.createBranch());
    register('ideagit.deleteBranch', node => this.deleteBranch(node));
    register('ideagit.compareBranch', node => this.compareBranch(node));
    register('ideagit.merge', node => this.merge(node));
    register('ideagit.rebase', node => this.rebase(node));
    register('ideagit.showCommitDetails', node => this.showCommitDetails(node));
    register('ideagit.cherryPick', node => this.cherryPick(node));
    register('ideagit.revertCommit', node => this.revertCommit(node));
    register('ideagit.resetToCommit', node => this.resetToCommit(node));
    register('ideagit.copyHash', node => this.copyHash(node));
    register('ideagit.stash', () => this.stash());
    register('ideagit.stashPopLatest', () => this.popLatestStash());
    register('ideagit.applyStash', node => this.applyStash(node));
    register('ideagit.popStash', node => this.popStash(node));
    register('ideagit.dropStash', node => this.dropStash(node));
    register('ideagit.resolveConflicts', node => this.resolveConflict(node));
    register('ideagit.markResolved', node => this.markResolved(node));
    register('ideagit.abortOperation', () => this.abortOperation());
  }

  private async addRepository(): Promise<void> {
    const selection = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      title: 'Add existing Git repository'
    });
    if (!selection?.[0]) {
      return;
    }
    await this.deps.repositories.addRepository(selection[0]);
    await this.deps.refreshAll();
  }

  private async initRepository(): Promise<void> {
    const selection = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      title: 'Initialize Git repository'
    });
    if (!selection?.[0]) {
      return;
    }
    await this.deps.git.run(selection[0].fsPath, ['init']);
    await this.deps.repositories.addRepository(selection[0]);
    await this.deps.refreshAll();
  }

  private async cloneRepository(): Promise<void> {
    const url = await vscode.window.showInputBox({ title: 'Clone Repository', prompt: 'Remote URL', ignoreFocusOut: true });
    if (!url?.trim()) {
      return;
    }
    const folder = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      title: 'Clone into folder'
    });
    if (!folder?.[0]) {
      return;
    }
    await this.deps.git.withProgress('Cloning repository', token =>
      this.deps.git.run(folder[0].fsPath, ['clone', url.trim()], { cancellationToken: token }).then(() => undefined)
    );
    await this.deps.repositories.refresh();
  }

  private selectRepository(value: unknown): void {
    const repository = value instanceof RepositoryNode ? value.repository : nodePayload(value);
    if (repository && typeof repository === 'object' && 'rootPath' in repository) {
      this.deps.repositories.select(String(repository.rootPath));
    }
  }

  private async createChangelist(): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const name = await vscode.window.showInputBox({ title: 'Create Changelist', prompt: 'Name', ignoreFocusOut: true });
    if (!name?.trim()) {
      return;
    }
    const description = await vscode.window.showInputBox({ title: 'Changelist Description', prompt: 'Optional description' });
    const changelist = await this.deps.changelists.create(repository.rootPath, name.trim(), description?.trim());
    await this.deps.localChanges.refresh();
    this.deps.commitWebview.refresh();
    void vscode.window.showInformationMessage(`Created changelist "${changelist.name}".`);
  }

  private async renameChangelist(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const node = value instanceof ChangelistNode ? value : undefined;
    const changelist = node?.changelist;
    if (!changelist) {
      return;
    }
    const name = await vscode.window.showInputBox({ title: 'Rename Changelist', value: changelist.name, ignoreFocusOut: true });
    if (!name?.trim()) {
      return;
    }
    await this.deps.changelists.rename(repository.rootPath, changelist.id, name.trim());
    await this.deps.localChanges.refresh();
  }

  private async deleteChangelist(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const node = value instanceof ChangelistNode ? value : undefined;
    const changelist = node?.changelist;
    if (!changelist || changelist.id === 'default') {
      return;
    }
    const confirmed = await this.deps.risk.confirm({
      title: 'Delete changelist?',
      object: changelist.name,
      impact: 'Files assigned to this changelist will move back to Default Changelist.',
      recoverability: 'The changelist grouping metadata will be removed.',
      confirmLabel: 'Delete Changelist'
    });
    if (!confirmed) {
      return;
    }
    await this.deps.changelists.delete(repository.rootPath, changelist.id);
    await this.deps.localChanges.refresh();
  }

  private async setActiveChangelist(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const node = value instanceof ChangelistNode ? value : undefined;
    if (!node) {
      return;
    }
    await this.deps.changelists.setActive(repository.rootPath, node.changelist.id);
    await this.deps.localChanges.refresh();
  }

  private async moveToChangelist(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const change = this.changeFrom(value);
    if (!change) {
      return;
    }
    const state = this.deps.changelists.getState(repository.rootPath);
    const selection = await vscode.window.showQuickPick(
      state.changelists.map(list => ({ label: list.name, description: list.active ? 'active' : undefined, id: list.id })),
      { title: 'Move to Changelist' }
    );
    if (!selection) {
      return;
    }
    await this.deps.changelists.moveChange(repository.rootPath, change, selection.id);
    await this.deps.localChanges.refresh();
    this.deps.commitWebview.refresh();
  }

  private async toggleIncluded(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const change = this.changeFrom(value);
    if (!change) {
      return;
    }
    const included = !this.deps.changelists.isIncluded(repository.rootPath, change);
    await this.deps.changelists.setIncluded(repository.rootPath, change, included);
    await this.deps.localChanges.refresh();
    this.deps.commitWebview.refresh();
  }

  private async showDiff(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const change = this.changeFrom(value);
    if (!change) {
      return;
    }
    const fileUri = vscode.Uri.file(fromGitPath(repository.rootPath, change.path));
    if (change.untracked) {
      await vscode.commands.executeCommand('vscode.open', fileUri);
      return;
    }
    const left = toGitUri(fileUri, 'HEAD');
    await vscode.commands.executeCommand('vscode.diff', left, fileUri, `${change.path} (HEAD <-> Working Tree)`);
  }

  private async openFile(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const change = this.changeFrom(value);
    if (!change) {
      return;
    }
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fromGitPath(repository.rootPath, change.path)));
  }

  private async revealFile(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const change = this.changeFrom(value);
    if (!change) {
      return;
    }
    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(fromGitPath(repository.rootPath, change.path)));
  }

  private async rollback(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const change = this.changeFrom(value);
    const changes = change ? [change] : this.deps.localChanges.getActiveIncludedChanges();
    if (!changes.length) {
      return;
    }
    const confirmed = await this.deps.risk.confirmRollback(changes);
    if (!confirmed) {
      return;
    }
    const tracked = changes.filter(item => !item.untracked).map(item => item.path);
    const untracked = changes.filter(item => item.untracked).map(item => item.path);
    if (tracked.length) {
      await this.deps.git.run(repository.rootPath, ['restore', '--worktree', '--staged', '--', ...tracked]);
    }
    if (untracked.length) {
      await this.deps.git.run(repository.rootPath, ['clean', '-f', '--', ...untracked]);
    }
    await this.deps.refreshAll();
  }

  private async commitInteractive(commitAndPush: boolean): Promise<void> {
    const message = await vscode.window.showInputBox({
      title: commitAndPush ? 'Commit and Push' : 'Commit',
      prompt: 'Commit message',
      ignoreFocusOut: true
    });
    if (!message?.trim()) {
      return;
    }
    await this.commitWithOptions({ message: message.trim(), amend: false, skipHooks: false, signoff: false, allowEmpty: false }, commitAndPush);
  }

  private async commitFromWebview(message: unknown, commitAndPush: boolean): Promise<void> {
    const data = asRecord(message);
    await this.commitWithOptions(
      {
        message: String(data.message ?? '').trim(),
        amend: Boolean(data.amend),
        skipHooks: Boolean(data.skipHooks),
        signoff: Boolean(data.signoff),
        allowEmpty: Boolean(data.allowEmpty),
        author: String(data.author ?? '').trim() || undefined
      },
      commitAndPush
    );
  }

  private async commitWithOptions(options: CommitOptions, commitAndPush: boolean): Promise<void> {
    if (!options.message && !options.allowEmpty) {
      throw new Error('Commit message is required.');
    }
    const repository = await this.deps.repositories.ensureSelected();
    const changes = this.deps.localChanges.getSelectedIncludedChanges();
    await this.deps.git.withProgress('Committing changes', token =>
      this.deps.commit.commit(repository.rootPath, changes, options, token)
    );
    const summary = await this.deps.commit.lastCommitSummary(repository.rootPath);
    void vscode.window.showInformationMessage(summary ? `Committed ${summary}` : 'Commit completed.');
    await this.deps.refreshAll();
    if (commitAndPush) {
      await this.deps.pushPreview.refresh();
      await this.pushInteractive(false);
    }
  }

  private async pushInteractive(force: boolean): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const target = await this.deps.push.defaultTarget(repository.rootPath, repository.branch);
    const outgoing = await this.deps.push.outgoing(repository.rootPath, repository.branch ?? 'HEAD', target);
    if (!force) {
      const detail = outgoing.commits.map(commit => `${commit.shortHash} ${commit.subject}`).join('\n') || 'No outgoing commits. Git push will still run.';
      const choice = await vscode.window.showInformationMessage(
        `Push ${repository.branch ?? 'HEAD'} to ${target.remote}/${target.branch}?`,
        { modal: true, detail },
        'Push',
        'Cancel'
      );
      if (choice !== 'Push') {
        return;
      }
    } else {
      const confirmed = await this.deps.risk.confirmForcePush(target.remote, target.branch, this.deps.push.formatOutgoing(outgoing.commits));
      if (!confirmed) {
        return;
      }
    }
    await this.runPush(repository.rootPath, target, force);
  }

  private async pushFromWebview(message: unknown, force: boolean): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const data = asRecord(message);
    const target: PushTarget = {
      remote: String(data.remote ?? 'origin').trim(),
      branch: String(data.branch ?? repository.branch ?? 'HEAD').trim(),
      setUpstream: Boolean(data.setUpstream)
    };
    if (!target.remote || !target.branch) {
      throw new Error('Remote and branch are required.');
    }
    if (force) {
      const outgoing = await this.deps.push.outgoing(repository.rootPath, repository.branch ?? 'HEAD', target);
      const confirmed = await this.deps.risk.confirmForcePush(target.remote, target.branch, this.deps.push.formatOutgoing(outgoing.commits));
      if (!confirmed) {
        return;
      }
    }
    await this.runPush(repository.rootPath, target, force);
  }

  private async runPush(repositoryRoot: string, target: PushTarget, force: boolean): Promise<void> {
    await this.deps.git.withProgress(force ? 'Force pushing with lease' : 'Pushing', token =>
      force ? this.deps.push.forcePushWithLease(repositoryRoot, target, token) : this.deps.push.push(repositoryRoot, target, token)
    );
    void vscode.window.showInformationMessage('Push completed.');
    await this.deps.refreshAll();
    await this.deps.pushPreview.refresh();
  }

  private async fetch(): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    await this.deps.git.withProgress('Fetching', token => this.deps.sync.fetch(repository.rootPath, undefined, token));
    await this.deps.refreshAll();
  }

  private async pull(rebase = false): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const changes = await this.deps.status.getChanges(repository.rootPath, false);
    if (changes.length) {
      const choice = await vscode.window.showWarningMessage(
        rebase ? 'Pull --rebase with uncommitted changes?' : 'Pull with uncommitted changes?',
        {
          modal: true,
          detail: 'Commit or stash local changes before pulling if you want to avoid conflicts.'
        },
        rebase ? 'Pull --rebase Anyway' : 'Pull Anyway',
        'Stash First',
        'Cancel'
      );
      if (choice === 'Cancel' || !choice) {
        return;
      }
      if (choice === 'Stash First') {
        await this.deps.stash.stash(repository.rootPath, rebase ? 'ideagit auto-stash before pull --rebase' : 'ideagit auto-stash before pull');
      }
    }
    await this.deps.git.withProgress(rebase ? 'Pulling with rebase' : 'Pulling', token =>
      rebase ? this.deps.sync.pullRebase(repository.rootPath, token) : this.deps.sync.pull(repository.rootPath, token)
    );
    await this.deps.refreshAll();
  }

  private async updateProject(): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    await this.deps.git.withProgress('Updating project', token => this.deps.sync.updateProject(repository.rootPath, token));
    await this.deps.refreshAll();
  }

  private async checkoutBranch(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const branch = this.branchFrom(value) ?? await this.pickBranch();
    if (!branch) {
      return;
    }
    const changes = await this.deps.status.getChanges(repository.rootPath, false);
    if (changes.length) {
      const choice = await vscode.window.showWarningMessage(
        `Checkout ${branch.name} with uncommitted changes?`,
        { modal: true, detail: 'You can keep changes, stash them first, or cancel.' },
        'Checkout',
        'Stash First',
        'Cancel'
      );
      if (!choice || choice === 'Cancel') {
        return;
      }
      if (choice === 'Stash First') {
        await this.deps.stash.stash(repository.rootPath, 'ideagit auto-stash before checkout');
      }
    }
    await this.deps.git.withProgress('Checking out branch', token =>
      branch.type === 'remote'
        ? this.deps.branch.checkoutRemote(repository.rootPath, branch.name, token)
        : this.deps.branch.checkout(repository.rootPath, branch.name, token)
    );
    await this.deps.refreshAll();
  }

  private async createBranch(): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const name = await vscode.window.showInputBox({ title: 'Create Branch', prompt: 'Branch name', ignoreFocusOut: true });
    if (!name?.trim()) {
      return;
    }
    await this.deps.branch.create(repository.rootPath, name.trim());
    await this.deps.refreshAll();
  }

  private async deleteBranch(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const branch = this.branchFrom(value);
    if (!branch || branch.type !== 'local') {
      return;
    }
    if (branch.current) {
      throw new Error('Cannot delete the current branch.');
    }
    const unmerged = await this.deps.branch.unmergedCommits(repository.rootPath, branch.name);
    const confirmed = await this.deps.risk.confirmDeleteBranch(branch.name, unmerged);
    if (!confirmed) {
      return;
    }
    await this.deps.branch.delete(repository.rootPath, branch.name, unmerged.length > 0);
    await this.deps.refreshAll();
  }

  private async compareBranch(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const branch = this.branchFrom(value) ?? await this.pickBranch();
    if (!branch) {
      return;
    }
    const output = await this.deps.branch.compareWithCurrent(repository.rootPath, branch.name);
    const doc = await vscode.workspace.openTextDocument({
      content: output || 'No differences found.',
      language: 'git-commit'
    });
    await vscode.window.showTextDocument(doc);
  }

  private async merge(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const branch = this.branchFrom(value) ?? await this.pickBranch();
    if (!branch) {
      return;
    }
    const confirmed = await this.deps.risk.confirm({
      title: 'Merge into current branch?',
      object: branch.name,
      impact: `Git will merge ${branch.name} into ${repository.branch ?? 'HEAD'}.`,
      recoverability: 'A merge commit can be reverted; unresolved conflicts can be aborted.',
      confirmLabel: 'Merge'
    });
    if (!confirmed) {
      return;
    }
    await this.deps.git.withProgress('Merging branch', token => this.deps.branch.merge(repository.rootPath, branch.name, token));
    await this.deps.refreshAll();
  }

  private async rebase(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const branch = this.branchFrom(value) ?? await this.pickBranch();
    if (!branch) {
      return;
    }
    const confirmed = await this.deps.risk.confirm({
      title: 'Rebase current branch?',
      object: branch.name,
      impact: `Git will replay ${repository.branch ?? 'HEAD'} on top of ${branch.name}.`,
      recoverability: 'Rebase rewrites local commit hashes. Abort is available while the operation is in progress.',
      confirmLabel: 'Rebase'
    });
    if (!confirmed) {
      return;
    }
    await this.deps.git.withProgress('Rebasing branch', token => this.deps.branch.rebase(repository.rootPath, branch.name, token));
    await this.deps.refreshAll();
  }

  private async showCommitDetails(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const commit = this.commitFrom(value);
    if (!commit) {
      return;
    }
    const details = await this.deps.log.details(repository.rootPath, commit.hash);
    const doc = await vscode.workspace.openTextDocument({ content: details, language: 'git-commit' });
    await vscode.window.showTextDocument(doc);
  }

  private async cherryPick(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const commit = this.commitFrom(value);
    if (!commit) {
      return;
    }
    const confirmed = await this.deps.risk.confirm({
      title: 'Cherry-pick commit?',
      object: `${commit.shortHash} ${commit.subject}`,
      impact: 'The selected commit will be applied to the current branch.',
      recoverability: 'Conflicts can be resolved or the cherry-pick can be aborted.',
      confirmLabel: 'Cherry-pick'
    });
    if (!confirmed) {
      return;
    }
    await this.deps.git.withProgress('Cherry-picking', token => this.deps.log.cherryPick(repository.rootPath, commit.hash, token));
    await this.deps.refreshAll();
  }

  private async revertCommit(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const commit = this.commitFrom(value);
    if (!commit) {
      return;
    }
    const confirmed = await this.deps.risk.confirm({
      title: 'Revert commit?',
      object: `${commit.shortHash} ${commit.subject}`,
      impact: 'Git will create a new commit that reverses the selected commit.',
      recoverability: 'The revert commit can itself be reverted later.',
      confirmLabel: 'Revert'
    });
    if (!confirmed) {
      return;
    }
    await this.deps.git.withProgress('Reverting commit', token => this.deps.log.revert(repository.rootPath, commit.hash, token));
    await this.deps.refreshAll();
  }

  private async resetToCommit(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const commit = this.commitFrom(value);
    if (!commit) {
      return;
    }
    const modePick = await vscode.window.showQuickPick(['soft', 'mixed', 'hard', 'keep'], {
      title: 'Reset Current Branch to Here'
    });
    if (!modePick) {
      return;
    }
    const mode = modePick as ResetMode;
    const changes = await this.deps.status.getChanges(repository.rootPath, false);
    const confirmed = await this.deps.risk.confirmReset(mode, commit.shortHash, changes);
    if (!confirmed) {
      return;
    }
    await this.deps.git.withProgress('Resetting branch', token => this.deps.log.reset(repository.rootPath, commit.hash, mode, token));
    await this.deps.refreshAll();
  }

  private async copyHash(value: unknown): Promise<void> {
    const commit = this.commitFrom(value);
    if (!commit) {
      return;
    }
    await vscode.env.clipboard.writeText(commit.hash);
  }

  private async stash(): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    await this.deps.stash.stash(repository.rootPath);
    await this.deps.refreshAll();
  }

  private async popLatestStash(): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const stashes = await this.deps.stash.list(repository.rootPath);
    const stash = stashes[0];
    if (!stash) {
      void vscode.window.showInformationMessage('No stashes found.');
      return;
    }
    try {
      await this.deps.stash.pop(repository.rootPath, stash.selector);
    } finally {
      await this.deps.refreshAll();
    }
  }

  private async applyStash(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const stash = this.stashFrom(value);
    if (!stash) {
      return;
    }
    try {
      await this.deps.stash.apply(repository.rootPath, stash.selector);
    } finally {
      await this.deps.refreshAll();
    }
  }

  private async popStash(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const stash = this.stashFrom(value);
    if (!stash) {
      return;
    }
    try {
      await this.deps.stash.pop(repository.rootPath, stash.selector);
    } finally {
      await this.deps.refreshAll();
    }
  }

  private async dropStash(value: unknown): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const stash = this.stashFrom(value);
    if (!stash) {
      return;
    }
    const confirmed = await this.deps.risk.confirmDropStash(stash.selector);
    if (!confirmed) {
      return;
    }
    await this.deps.stash.drop(repository.rootPath, stash.selector);
    await this.deps.refreshAll();
  }

  private async resolveConflict(value: unknown): Promise<void> {
    const conflict = this.conflictFrom(value);
    if (!conflict) {
      await vscode.commands.executeCommand('ideagit.conflicts.focus');
      return;
    }
    await this.deps.conflicts.openMergeEditor(conflict);
  }

  private async markResolved(value: unknown): Promise<void> {
    const conflict = this.conflictFrom(value);
    if (!conflict) {
      return;
    }
    let continued = false;
    try {
      continued = await this.deps.conflicts.markResolved(conflict);
    } finally {
      await this.deps.refreshAll();
    }
    if (continued) {
      void vscode.window.showInformationMessage('Rebase continued after resolving conflicts.');
    }
  }

  private async abortOperation(): Promise<void> {
    const repository = await this.deps.repositories.ensureSelected();
    const operation = await this.deps.repositories.detectOperation(repository.rootPath);
    if (operation.kind === 'none') {
      void vscode.window.showInformationMessage('No abortable Git operation is in progress.');
      return;
    }
    const confirmed = await this.deps.risk.confirmAbort(operation.kind);
    if (!confirmed) {
      return;
    }
    await this.deps.conflicts.abort(repository.rootPath, operation.kind);
    await this.deps.refreshAll();
  }

  private async pickBranch(): Promise<BranchInfo | undefined> {
    const repository = await this.deps.repositories.ensureSelected();
    const branches = await this.deps.branch.list(repository.rootPath);
    const pick = await vscode.window.showQuickPick(
      branches.map(branch => ({
        label: branch.name,
        description: `${branch.type}${branch.current ? ' - current' : ''}`,
        branch
      })),
      { title: 'Select Branch' }
    );
    return pick?.branch;
  }

  private changeFrom(value: unknown): GitChange | undefined {
    if (value instanceof ChangeNode) {
      return value.change;
    }
    return nodePayload<GitChange>(value);
  }

  private branchFrom(value: unknown): BranchInfo | undefined {
    if (value instanceof BranchNode) {
      return value.branch;
    }
    return nodePayload<BranchInfo>(value);
  }

  private commitFrom(value: unknown): CommitInfo | undefined {
    if (value instanceof CommitNode) {
      return value.commit;
    }
    return nodePayload<CommitInfo>(value);
  }

  private stashFrom(value: unknown): StashInfo | undefined {
    if (value instanceof StashNode) {
      return value.stash;
    }
    return nodePayload<StashInfo>(value);
  }

  private conflictFrom(value: unknown): ConflictInfo | undefined {
    if (value instanceof ConflictNode) {
      return value.conflict;
    }
    return nodePayload<ConflictInfo>(value);
  }

  private async runSafely(task: () => unknown): Promise<void> {
    try {
      await task();
    } catch (error) {
      const message = error instanceof GitCliError || error instanceof Error ? error.message : String(error);
      this.deps.output.error(message);
      const choice = await vscode.window.showErrorMessage(message, 'Show Output');
      if (choice === 'Show Output') {
        this.deps.output.show();
      }
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function toGitUri(uri: vscode.Uri, ref: string): vscode.Uri {
  return uri.with({
    scheme: 'git',
    path: uri.path,
    query: JSON.stringify({ path: uri.fsPath, ref })
  });
}
