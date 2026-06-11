import * as vscode from 'vscode';
import { BranchService } from './git/branchService';
import { CommitService } from './git/commitService';
import { ConflictService } from './git/conflictService';
import { GitCliService } from './git/gitCliService';
import { LogService } from './git/logService';
import { PushService } from './git/pushService';
import { RepositoryService } from './git/repositoryService';
import { RiskConfirmationService } from './git/riskConfirmationService';
import { StashService } from './git/stashService';
import { StatusService } from './git/statusService';
import { SyncService } from './git/syncService';
import { MetadataStore } from './state/metadataStore';
import { ChangelistService } from './state/changelistService';
import { Output } from './utils/output';
import { debounce } from './utils/debounce';
import { RepositoriesView } from './ui/repositoriesView';
import { LocalChangesView } from './ui/localChangesView';
import { BranchesView } from './ui/branchesView';
import { LogView } from './ui/logView';
import { SyncView } from './ui/syncView';
import { ConflictsView } from './ui/conflictsView';
import { StashView } from './ui/stashView';
import { CommitWebviewProvider } from './ui/commitWebview';
import { PushPreviewWebviewProvider } from './ui/pushPreviewWebview';
import { CommandRegistry } from './commands/commandRegistry';
import { CommitFileNode, CommitNode } from './ui/nodes';
import { fromGitPath } from './utils/pathUtils';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = new Output();
  const git = new GitCliService(output);
  const repositories = new RepositoryService(git);
  const status = new StatusService(git);
  const metadata = new MetadataStore(context);
  const changelists = new ChangelistService(metadata);
  const risk = new RiskConfirmationService();
  const commit = new CommitService(git, status);
  const push = new PushService(git);
  const branch = new BranchService(git);
  const log = new LogService(git);
  const sync = new SyncService(git);
  const stash = new StashService(git);

  const repositoriesView = new RepositoriesView(repositories);
  const localChangesView = new LocalChangesView(repositories, status, changelists);
  const branchesView = new BranchesView(repositories, branch);
  const logView = new LogView(repositories, log);
  const syncView = new SyncView(repositories);
  const conflicts = new ConflictService(git, status, repositories);
  const conflictsView = new ConflictsView(repositories, conflicts);
  const stashView = new StashView(repositories, stash);
  const commitWebview = new CommitWebviewProvider();
  const pushPreview = new PushPreviewWebviewProvider(repositories, push);
  const localChangesTree = vscode.window.createTreeView('ideagit.localChanges', {
    treeDataProvider: localChangesView,
    manageCheckboxStateManually: true
  });
  const logTree = vscode.window.createTreeView('ideagit.log', {
    treeDataProvider: logView
  });
  logView.bindTreeView(logTree);
  context.subscriptions.push(localChangesTree.onDidChangeCheckboxState(event => void localChangesView.updateIncludedFromCheckbox(event.items)));
  context.subscriptions.push(logTree.onDidChangeSelection(event => {
    const commit = event.selection.find((item): item is CommitNode => item instanceof CommitNode);
    if (commit) {
      void logView.expandCommit(commit);
    }
  }));

  const refreshAll = async () => {
    await repositories.refresh();
    await Promise.all([
      localChangesView.refresh(),
      branchesView.refresh(),
      logView.refresh(),
      conflictsView.refresh(),
      stashView.refresh(),
      pushPreview.refresh()
    ]);
    syncView.refresh();
    repositoriesView.refresh();
    commitWebview.refresh();
  };

  context.subscriptions.push(
    output,
    repositories,
    vscode.window.registerTreeDataProvider('ideagit.repositories', repositoriesView),
    localChangesTree,
    vscode.window.registerTreeDataProvider('ideagit.branches', branchesView),
    logTree,
    vscode.window.registerTreeDataProvider('ideagit.sync', syncView),
    vscode.window.registerTreeDataProvider('ideagit.conflicts', conflictsView),
    vscode.window.registerTreeDataProvider('ideagit.stash', stashView),
    vscode.window.registerWebviewViewProvider('ideagit.commitView', commitWebview),
    vscode.window.registerWebviewViewProvider('ideagit.pushPreview', pushPreview),
    vscode.commands.registerCommand('ideagit.expandCommitFiles', (node?: unknown) => {
      if (node instanceof CommitNode) {
        void logView.expandCommit(node, { focus: true, select: true });
      }
    }),
    vscode.commands.registerCommand('ideagit.showCommitFileDiff', (node?: unknown) => {
      if (node instanceof CommitFileNode) {
        const fileUri = vscode.Uri.file(fromGitPath(node.repositoryRoot, node.filePath));
        const before = toGitUri(fileUri, `${node.commit.hash}^`);
        const after = toGitUri(fileUri, node.commit.hash);
        void vscode.commands.executeCommand(
          'vscode.diff',
          before,
          after,
          `${node.filePath} (${node.commit.shortHash})`
        );
      }
    })
  );

  new CommandRegistry({
    output,
    git,
    repositories,
    status,
    changelists,
    localChanges: localChangesView,
    commit,
    push,
    branch,
    log,
    sync,
    conflicts,
    stash,
    risk,
    commitWebview,
    pushPreview,
    refreshAll
  }).register(context);

  const refreshDebounce = vscode.workspace.getConfiguration('ideagit').get<number>('statusRefreshDebounceMs', 650);
  const debouncedRefresh = debounce(() => {
    void refreshAll();
  }, refreshDebounce);

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => void refreshAll()),
    vscode.workspace.onDidSaveTextDocument(() => debouncedRefresh()),
    vscode.workspace.onDidCreateFiles(() => debouncedRefresh()),
    vscode.workspace.onDidDeleteFiles(() => debouncedRefresh()),
    vscode.workspace.onDidRenameFiles(() => debouncedRefresh()),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('ideagit')) {
        void refreshAll();
      }
    })
  );

  await refreshAll();
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions.
}

function toGitUri(uri: vscode.Uri, ref: string): vscode.Uri {
  return uri.with({
    scheme: 'git',
    path: uri.path,
    query: JSON.stringify({ path: uri.fsPath, ref })
  });
}
