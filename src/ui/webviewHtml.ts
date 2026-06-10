import * as crypto from 'crypto';
import * as vscode from 'vscode';

export function nonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

export function panelHtml(webview: vscode.Webview, title: string, body: string, script: string): string {
  const value = nonce();
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${value}'`,
    `img-src ${webview.cspSource} https: data:`
  ].join('; ');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    html, body {
      height: 100%;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      padding: 8px;
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      background: var(--vscode-sideBarSectionHeader-background, var(--vscode-editor-background));
      position: sticky;
      top: 0;
      z-index: 1;
    }
    button, select, input, textarea {
      font: inherit;
    }
    button {
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      min-height: 28px;
      padding: 4px 10px;
      border-radius: 3px;
      cursor: pointer;
      white-space: nowrap;
    }
    button:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground); }
    button:disabled {
      opacity: .55;
      cursor: default;
    }
    textarea, input, select {
      box-sizing: border-box;
      width: 100%;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      padding: 6px;
    }
    textarea:focus, input:focus, select:focus, button:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }
    textarea {
      min-height: 88px;
      resize: vertical;
    }
    .content {
      padding: 10px 8px 12px;
      display: grid;
      gap: 12px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      min-width: 0;
    }
    .row > label {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      white-space: nowrap;
    }
    .field {
      display: grid;
      gap: 5px;
      min-width: 0;
    }
    .field-title, .section-title {
      color: var(--vscode-foreground);
      font-weight: 600;
      font-size: 12px;
    }
    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .summary-strip {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-radius: 6px;
      background: var(--vscode-list-hoverBackground);
    }
    .summary-main {
      min-width: 0;
    }
    .repo-name {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .count-pill {
      display: grid;
      justify-items: center;
      min-width: 58px;
      padding: 4px 8px;
      border: 1px solid var(--vscode-badge-background);
      border-radius: 999px;
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
      line-height: 1.1;
    }
    .count-pill strong {
      font-size: 13px;
    }
    .count-pill span {
      font-size: 10px;
      text-transform: uppercase;
    }
    .option-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }
    .check-option {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      padding: 6px 7px;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-radius: 4px;
      background: var(--vscode-editor-background);
    }
    .check-option input {
      flex: 0 0 auto;
      width: auto;
      margin: 0;
    }
    .check-option span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .section-block {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .count-token {
      color: var(--vscode-descriptionForeground);
      font-weight: 400;
    }
    .meta {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .list {
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-radius: 4px;
      background: var(--vscode-editor-background);
      max-height: 42vh;
      overflow: auto;
    }
    .tree-group, .tree-node {
      min-width: 0;
    }
    .tree-group summary, .tree-node summary {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      min-height: 26px;
      padding: 3px 8px;
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      cursor: default;
      user-select: none;
    }
    .tree-node summary {
      padding-left: var(--indent, 22px);
    }
    .tree-group summary:hover, .tree-node summary:hover, .file-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .tree-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    .item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      padding: 5px 8px;
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      min-width: 0;
    }
    .file-item {
      padding-left: var(--indent, 8px);
    }
    .item:last-child { border-bottom: 0; }
    .item > span {
      min-width: 0;
    }
    .file-path {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .status-code {
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
    }
    .status-mark {
      display: inline-grid;
      place-items: center;
      width: 18px;
      height: 18px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      font-weight: 700;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-list-inactiveSelectionBackground);
    }
    .status-added .status-mark, .status-untracked .status-mark {
      color: var(--vscode-gitDecoration-addedResourceForeground);
    }
    .status-modified .status-mark, .status-renamed .status-mark, .status-copied .status-mark {
      color: var(--vscode-gitDecoration-modifiedResourceForeground);
    }
    .status-deleted .status-mark {
      color: var(--vscode-gitDecoration-deletedResourceForeground);
    }
    .status-conflicted .status-mark {
      color: var(--vscode-gitDecoration-conflictingResourceForeground);
    }
    .hash {
      color: var(--vscode-gitDecoration-addedResourceForeground);
      font-family: var(--vscode-editor-font-family);
    }
    .empty {
      padding: 10px;
      color: var(--vscode-descriptionForeground);
    }
    .danger {
      color: var(--vscode-errorForeground);
    }
    .commit-view {
      display: grid;
      gap: 7px;
      min-width: 0;
      padding: 6px 8px 8px;
    }
    .commit-footer {
      display: grid;
      gap: 7px;
      background: var(--vscode-sideBar-background);
    }
    textarea.commit-message {
      min-height: 88px;
      max-height: 28vh;
    }
    .commit-options-line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
      min-width: 0;
    }
    .inline-check {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }
    .inline-check input {
      width: auto;
      margin: 0;
    }
    .more-options {
      min-width: 0;
    }
    .more-options summary {
      color: var(--vscode-descriptionForeground);
      cursor: default;
      user-select: none;
      white-space: nowrap;
    }
    .more-options-body {
      display: grid;
      gap: 7px;
      min-width: min(260px, calc(100vw - 16px));
      padding-top: 7px;
    }
    .commit-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      min-width: 0;
    }
    .commit-actions button {
      flex: 0 0 auto;
      max-width: 100%;
    }
  </style>
</head>
<body>
${body}
<script nonce="${value}">
${script}
</script>
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
