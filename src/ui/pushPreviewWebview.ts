import * as vscode from 'vscode';
import { PushService } from '../git/pushService';
import { RepositoryService } from '../git/repositoryService';
import { CommitInfo, PushTarget } from '../models';
import { escapeHtml, panelHtml } from './webviewHtml';

export class PushPreviewWebviewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private target?: PushTarget;
  private commits: CommitInfo[] = [];

  constructor(
    private readonly repositories: RepositoryService,
    private readonly pushService: PushService
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage(message => {
      if (message?.command === 'push') {
        void vscode.commands.executeCommand('ideagit.pushFromWebview', message);
      }
      if (message?.command === 'forcePush') {
        void vscode.commands.executeCommand('ideagit.forcePushFromWebview', message);
      }
      if (message?.command === 'refresh') {
        void this.refresh();
      }
    });
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const repository = this.repositories.selected;
    if (repository) {
      this.target = await this.pushService.defaultTarget(repository.rootPath, repository.branch);
      const outgoing = await this.pushService.outgoing(repository.rootPath, repository.branch ?? 'HEAD', this.target);
      this.commits = outgoing.commits;
    } else {
      this.target = undefined;
      this.commits = [];
    }
    this.render();
  }

  private render(): void {
    if (!this.view) {
      return;
    }
    const repository = this.repositories.selected;
    const target = this.target;
    const commits = this.commits.length
      ? this.commits.map(commit => `<div class="item"><span class="hash">${escapeHtml(commit.shortHash)}</span><span>${escapeHtml(commit.subject)}</span><span class="meta">${escapeHtml(commit.author)}</span></div>`).join('')
      : '<div class="empty">No outgoing commits found.</div>';
    this.view.webview.html = panelHtml(
      this.view.webview,
      'Push Preview',
      `<div class="toolbar">
  <button id="push">Push</button>
  <button id="forcePush" class="secondary">Force With Lease</button>
  <button id="refresh" class="secondary">Refresh</button>
</div>
<div class="content">
  <div>
    <div class="meta">Repository</div>
    <strong>${escapeHtml(repository?.name ?? 'No repository')}</strong>
  </div>
  <div class="row">
    <label><span class="meta">Remote</span><input id="remote" value="${escapeHtml(target?.remote ?? 'origin')}"></label>
    <label><span class="meta">Branch</span><input id="branch" value="${escapeHtml(target?.branch ?? repository?.branch ?? 'HEAD')}"></label>
    <label><input type="checkbox" id="upstream" ${target?.setUpstream ? 'checked' : ''}> Set upstream</label>
  </div>
  <div>
    <div class="meta">Outgoing Commits (${this.commits.length})</div>
    <div class="list">${commits}</div>
  </div>
</div>`,
      `const vscode = acquireVsCodeApi();
function payload(command) {
  return {
    command,
    remote: document.getElementById('remote').value,
    branch: document.getElementById('branch').value,
    setUpstream: document.getElementById('upstream').checked
  };
}
document.getElementById('push').addEventListener('click', () => vscode.postMessage(payload('push')));
document.getElementById('forcePush').addEventListener('click', () => vscode.postMessage(payload('forcePush')));
document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ command: 'refresh' }));`
    );
  }
}
