import * as vscode from 'vscode';
import { GitResult } from '../models';

export class Output {
  private readonly channel = vscode.window.createOutputChannel('ideagit');

  dispose(): void {
    this.channel.dispose();
  }

  show(): void {
    this.channel.show(true);
  }

  info(message: string): void {
    this.channel.appendLine(`[info] ${message}`);
  }

  warn(message: string): void {
    this.channel.appendLine(`[warn] ${message}`);
  }

  error(message: string): void {
    this.channel.appendLine(`[error] ${message}`);
  }

  git(result: GitResult): void {
    const code = result.exitCode === null ? `signal ${result.signal ?? 'unknown'}` : `exit ${result.exitCode}`;
    this.channel.appendLine(`$ git ${result.args.join(' ')} (${code}, ${result.durationMs}ms)`);
    if (result.stdout.trim()) {
      this.channel.appendLine(result.stdout.trimEnd());
    }
    if (result.stderr.trim()) {
      this.channel.appendLine(result.stderr.trimEnd());
    }
  }
}
