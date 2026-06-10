import * as vscode from 'vscode';
import { panelHtml } from './webviewHtml';

export class CommitWebviewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage(message => {
      if (message?.command === 'commit') {
        void vscode.commands.executeCommand('ideagit.commitFromWebview', message);
      }
      if (message?.command === 'commitAndPush') {
        void vscode.commands.executeCommand('ideagit.commitAndPushFromWebview', message);
      }
      if (message?.command === 'push') {
        void vscode.commands.executeCommand('ideagit.push');
      }
      if (message?.command === 'stash') {
        void vscode.commands.executeCommand('ideagit.stash');
      }
      if (message?.command === 'stashPopLatest') {
        void vscode.commands.executeCommand('ideagit.stashPopLatest');
      }
      if (message?.command === 'pullRebase') {
        void vscode.commands.executeCommand('ideagit.pullRebase');
      }
    });
    this.refresh();
  }

  refresh(): void {
    if (!this.view) {
      return;
    }
    this.view.webview.html = this.render(this.view.webview);
  }

  private render(webview: vscode.Webview): string {
    return panelHtml(
      webview,
      'Commit',
      `<div class="commit-view">
  <section class="commit-footer">
    <textarea id="message" class="commit-message" placeholder="Commit message"></textarea>
    <div class="commit-options-line">
      <label class="inline-check"><input type="checkbox" id="amend"> <span>Amend</span></label>
      <label class="inline-check"><input type="checkbox" id="signoff"> <span>Sign-off</span></label>
      <details class="more-options">
        <summary>More</summary>
        <div class="more-options-body">
          <label class="inline-check"><input type="checkbox" id="skipHooks"> <span>Skip hooks</span></label>
          <label class="inline-check"><input type="checkbox" id="allowEmpty"> <span>Allow empty</span></label>
          <input id="author" placeholder="Author: Name &lt;email@example.com&gt;">
        </div>
      </details>
    </div>
    <div class="commit-actions">
      <button id="commit">Commit</button>
      <button id="push" class="secondary">Push</button>
      <button id="commitPush" class="secondary">Commit and Push...</button>
      <button id="stash" class="secondary">Stash</button>
      <button id="stashPop" class="secondary">Stash Pop</button>
      <button id="pullRebase" class="secondary">Pull --rebase</button>
    </div>
  </section>
</div>`,
      `const vscode = acquireVsCodeApi();
const message = document.getElementById('message');
function payload(command) {
  return {
    command,
    message: message.value,
    amend: document.getElementById('amend').checked,
    skipHooks: document.getElementById('skipHooks').checked,
    signoff: document.getElementById('signoff').checked,
    allowEmpty: document.getElementById('allowEmpty').checked,
    author: document.getElementById('author').value
  };
}
document.getElementById('commit').addEventListener('click', () => vscode.postMessage(payload('commit')));
document.getElementById('push').addEventListener('click', () => vscode.postMessage({ command: 'push' }));
document.getElementById('commitPush').addEventListener('click', () => vscode.postMessage(payload('commitAndPush')));
document.getElementById('stash').addEventListener('click', () => vscode.postMessage({ command: 'stash' }));
document.getElementById('stashPop').addEventListener('click', () => vscode.postMessage({ command: 'stashPopLatest' }));
document.getElementById('pullRebase').addEventListener('click', () => vscode.postMessage({ command: 'pullRebase' }));`
    );
  }
}
