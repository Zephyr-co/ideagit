import * as vscode from 'vscode';
import { LogService } from '../git/logService';
import { RepositoryService } from '../git/repositoryService';
import { CommitInfo } from '../models';
import { CommitDirectoryNode, CommitFileNode, CommitNode, IdeaGitNode, MessageNode } from './nodes';

interface CommitTreeDirectory {
  name: string;
  pathPrefix: string;
  children: Map<string, CommitTreeDirectory>;
  files: string[];
  allFiles: string[];
}

export class LogView implements vscode.TreeDataProvider<IdeaGitNode> {
  private readonly changeEmitter = new vscode.EventEmitter<IdeaGitNode | undefined | void>();
  private commits: CommitInfo[] = [];
  private readonly commitFileCache = new Map<string, string[]>();
  readonly onDidChangeTreeData = this.changeEmitter.event;
  private treeView?: vscode.TreeView<IdeaGitNode>;

  constructor(
    private readonly repositories: RepositoryService,
    private readonly logService: LogService
  ) {
    this.repositories.onDidChangeRepositories(() => void this.refresh());
  }

  async refresh(query?: string): Promise<void> {
    const repository = this.repositories.selected;
    this.commits = repository ? await this.logService.list(repository.rootPath, query) : [];
    this.commitFileCache.clear();
    this.changeEmitter.fire();
  }

  bindTreeView(treeView: vscode.TreeView<IdeaGitNode>): void {
    this.treeView = treeView;
  }

  async expandCommit(commit: CommitNode, options: { focus?: boolean; select?: boolean } = {}): Promise<void> {
    await this.treeView?.reveal(commit, { expand: true, focus: options.focus, select: options.select });
  }

  getTreeItem(element: IdeaGitNode): vscode.TreeItem {
    return element;
  }

  getParent(element: IdeaGitNode): IdeaGitNode | undefined {
    if (element instanceof CommitDirectoryNode || element instanceof CommitFileNode) {
      return new CommitNode(element.commit);
    }
    return undefined;
  }

  async getChildren(element?: IdeaGitNode): Promise<IdeaGitNode[]> {
    const repository = this.repositories.selected;
    if (!repository) {
      return [new MessageNode('No selected repository')];
    }
    if (element instanceof CommitNode) {
      const files = await this.filesForCommit(repository.rootPath, element.commit);
      return files.length
        ? this.nodesForFiles(repository.rootPath, element.commit, files)
        : [new MessageNode('No files found')];
    }
    if (element instanceof CommitDirectoryNode) {
      return this.nodesForFiles(repository.rootPath, element.commit, element.files, element.pathPrefix);
    }
    if (element) {
      return [];
    }
    return this.commits.length ? this.commits.map(commit => new CommitNode(commit)) : [new MessageNode('No commits found')];
  }

  private nodesForFiles(repositoryRoot: string, commit: CommitInfo, files: string[], prefix = ''): IdeaGitNode[] {
    const directory = this.buildTree(files, prefix);
    const nodes: IdeaGitNode[] = [];

    for (const child of [...directory.children.values()].sort(compareDirectories)) {
      nodes.push(new CommitDirectoryNode(repositoryRoot, commit, child.name, child.pathPrefix, child.allFiles));
    }

    for (const file of directory.files.sort(compareFiles)) {
      const label = file.slice(prefix.length).replace(/^\//, '') || file;
      nodes.push(new CommitFileNode(repositoryRoot, commit, file, label));
    }

    return nodes;
  }

  private buildTree(files: string[], prefix: string): CommitTreeDirectory {
    const root: CommitTreeDirectory = {
      name: '',
      pathPrefix: prefix,
      children: new Map(),
      files: [],
      allFiles: [...files]
    };

    for (const file of files) {
      const relativePath = prefix ? file.slice(prefix.length).replace(/^\//, '') : file;
      const segments = relativePath.split('/').filter(Boolean);
      if (segments.length <= 1) {
        root.files.push(file);
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
            files: [],
            allFiles: []
          };
          current.children.set(segment, child);
        }
        child.allFiles.push(file);
        current = child;
      }
      current.files.push(file);
    }

    return this.compactDirectories(root);
  }

  private compactDirectories(directory: CommitTreeDirectory): CommitTreeDirectory {
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
        directory.files = onlyChild.files;
        directory.allFiles = onlyChild.allFiles;
      }
    }

    return directory;
  }

  private async filesForCommit(repositoryRoot: string, commit: CommitInfo): Promise<string[]> {
    const cacheKey = `${repositoryRoot}:${commit.hash}`;
    const cached = this.commitFileCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const files = await this.logService.files(repositoryRoot, commit.hash);
    this.commitFileCache.set(cacheKey, files);
    return files;
  }
}

function compareDirectories(a: CommitTreeDirectory, b: CommitTreeDirectory): number {
  return a.name.localeCompare(b.name);
}

function compareFiles(a: string, b: string): number {
  return a.localeCompare(b);
}
