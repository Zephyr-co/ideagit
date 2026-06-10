import * as path from 'path';
import * as vscode from 'vscode';
import { GitOperationState, GitRepository } from '../models';
import { basename, normalizeRepositoryPath } from '../utils/pathUtils';
import { GitCliService } from './gitCliService';
import { parsePorcelainStatus } from './gitParsers';

export class RepositoryService {
  private repositories = new Map<string, GitRepository>();
  private selectedRoot?: string;
  private readonly onDidChangeRepositoriesEmitter = new vscode.EventEmitter<void>();
  private readonly statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

  readonly onDidChangeRepositories = this.onDidChangeRepositoriesEmitter.event;

  constructor(private readonly git: GitCliService) {
    this.statusBar.command = 'ideagit.selectRepository';
    this.statusBar.tooltip = 'ideagit repository';
    this.statusBar.show();
  }

  dispose(): void {
    this.statusBar.dispose();
    this.onDidChangeRepositoriesEmitter.dispose();
  }

  get all(): GitRepository[] {
    return [...this.repositories.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  get selected(): GitRepository | undefined {
    if (this.selectedRoot) {
      return this.repositories.get(this.selectedRoot);
    }
    return this.all[0];
  }

  async refresh(): Promise<void> {
    const roots = await this.discoverRepositories();
    const next = new Map<string, GitRepository>();

    for (const rootPath of roots) {
      const previous = this.repositories.get(rootPath);
      const repository = await this.loadRepository(rootPath, previous);
      next.set(rootPath, repository);
    }

    this.repositories = next;
    if (!this.selectedRoot || !this.repositories.has(this.selectedRoot)) {
      this.selectedRoot = this.all[0]?.rootPath;
    }
    this.updateStatusBar();
    this.onDidChangeRepositoriesEmitter.fire();
  }

  async addRepository(uri: vscode.Uri): Promise<void> {
    const rootPath = normalizeRepositoryPath(uri.fsPath);
    const result = await this.git.run(rootPath, ['rev-parse', '--show-toplevel']);
    const actualRoot = normalizeRepositoryPath(result.stdout.trim());
    if (!this.repositories.has(actualRoot)) {
      this.repositories.set(actualRoot, await this.loadRepository(actualRoot));
    }
    this.selectedRoot = actualRoot;
    this.updateStatusBar();
    this.onDidChangeRepositoriesEmitter.fire();
  }

  select(rootPath: string): void {
    const normalized = normalizeRepositoryPath(rootPath);
    if (this.repositories.has(normalized)) {
      this.selectedRoot = normalized;
      this.updateStatusBar();
      this.onDidChangeRepositoriesEmitter.fire();
    }
  }

  async ensureSelected(): Promise<GitRepository> {
    if (!this.selected) {
      await this.refresh();
    }
    const repository = this.selected;
    if (!repository) {
      throw new Error('No Git repository found in this workspace.');
    }
    return repository;
  }

  private async discoverRepositories(): Promise<string[]> {
    const found = new Set<string>();
    const folders = vscode.workspace.workspaceFolders ?? [];

    for (const folder of folders) {
      await this.discoverFromFolder(folder.uri.fsPath, found);
    }

    return [...found].sort((a, b) => a.localeCompare(b));
  }

  private async discoverFromFolder(folderPath: string, found: Set<string>): Promise<void> {
    const root = normalizeRepositoryPath(folderPath);
    try {
      const result = await this.git.run(root, ['rev-parse', '--show-toplevel'], { allowNonZeroExit: true });
      if (result.exitCode === 0) {
        found.add(normalizeRepositoryPath(result.stdout.trim()));
        return;
      }
    } catch {
      // Discovery falls back to scanning immediate children.
    }

    const candidates = await vscode.workspace.fs.readDirectory(vscode.Uri.file(root)).then(
      entries => entries.filter(([, type]) => type === vscode.FileType.Directory).map(([name]) => path.join(root, name)),
      () => []
    );

    await Promise.all(
      candidates.slice(0, 80).map(async candidate => {
        try {
          const result = await this.git.run(candidate, ['rev-parse', '--show-toplevel'], { allowNonZeroExit: true });
          if (result.exitCode === 0) {
            found.add(normalizeRepositoryPath(result.stdout.trim()));
          }
        } catch {
          // Ignore non-repository child folders.
        }
      })
    );
  }

  private async loadRepository(rootPath: string, previous?: GitRepository): Promise<GitRepository> {
    const [branchResult, upstreamResult, aheadBehindResult, statusResult, operation] = await Promise.all([
      this.git.run(rootPath, ['branch', '--show-current'], { allowNonZeroExit: true }),
      this.git.run(rootPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { allowNonZeroExit: true }),
      this.git.run(rootPath, ['rev-list', '--left-right', '--count', 'HEAD...@{u}'], { allowNonZeroExit: true }),
      this.git.run(rootPath, ['status', '--porcelain=v1', '-z', '--ignored=matching'], { allowNonZeroExit: true }),
      this.detectOperation(rootPath)
    ]);

    const changes = statusResult.exitCode === 0 ? parsePorcelainStatus(rootPath, statusResult.stdout) : [];
    const [aheadRaw, behindRaw] = aheadBehindResult.exitCode === 0 ? aheadBehindResult.stdout.trim().split(/\s+/) : ['0', '0'];
    const branch = branchResult.stdout.trim() || previous?.branch || 'DETACHED';
    const upstream = upstreamResult.exitCode === 0 ? upstreamResult.stdout.trim() : undefined;

    return {
      rootUri: vscode.Uri.file(rootPath),
      rootPath,
      name: basename(rootPath),
      branch,
      upstream,
      ahead: Number.parseInt(aheadRaw ?? '0', 10) || 0,
      behind: Number.parseInt(behindRaw ?? '0', 10) || 0,
      dirtyCount: changes.filter(change => !change.ignored).length,
      conflictCount: changes.filter(change => change.conflicted).length,
      operation
    };
  }

  async detectOperation(rootPath: string): Promise<GitOperationState> {
    const gitDirResult = await this.git.run(rootPath, ['rev-parse', '--git-dir'], { allowNonZeroExit: true });
    if (gitDirResult.exitCode !== 0) {
      return { kind: 'none' };
    }
    const gitDir = path.isAbsolute(gitDirResult.stdout.trim())
      ? gitDirResult.stdout.trim()
      : path.join(rootPath, gitDirResult.stdout.trim());

    const exists = async (relative: string) => {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(path.join(gitDir, relative)));
        return true;
      } catch {
        return false;
      }
    };

    if (await exists('MERGE_HEAD')) {
      return { kind: 'merge', detail: 'Merge in progress' };
    }
    if ((await exists('rebase-merge')) || (await exists('rebase-apply'))) {
      return { kind: 'rebase', detail: 'Rebase in progress' };
    }
    if (await exists('CHERRY_PICK_HEAD')) {
      return { kind: 'cherry-pick', detail: 'Cherry-pick in progress' };
    }
    if (await exists('REVERT_HEAD')) {
      return { kind: 'revert', detail: 'Revert in progress' };
    }
    return { kind: 'none' };
  }

  private updateStatusBar(): void {
    const selected = this.selected;
    if (!selected) {
      this.statusBar.text = '$(git-branch) ideagit';
      return;
    }
    const sync = selected.ahead || selected.behind ? ` up${selected.ahead} down${selected.behind}` : '';
    const dirty = selected.dirtyCount ? ` - ${selected.dirtyCount}` : '';
    const operation = selected.operation?.kind && selected.operation.kind !== 'none' ? ` - ${selected.operation.kind}` : '';
    this.statusBar.text = `$(git-branch) ${selected.name}:${selected.branch ?? 'HEAD'}${sync}${dirty}${operation}`;
  }
}
