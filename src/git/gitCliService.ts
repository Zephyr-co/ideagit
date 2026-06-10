import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { GitResult } from '../models';
import { Output } from '../utils/output';

export class GitCliError extends Error {
  constructor(
    message: string,
    readonly result: GitResult
  ) {
    super(message);
  }
}

export interface GitRunOptions {
  allowNonZeroExit?: boolean;
  input?: string;
  cancellationToken?: vscode.CancellationToken;
  env?: NodeJS.ProcessEnv;
}

export class GitCliService {
  constructor(private readonly output: Output) {}

  async run(cwd: string, args: string[], options: GitRunOptions = {}): Promise<GitResult> {
    const gitPath = vscode.workspace.getConfiguration('ideagit').get<string>('gitPath', 'git');
    const started = Date.now();

    return new Promise<GitResult>((resolve, reject) => {
      const child = spawn(gitPath, args, {
        cwd,
        shell: false,
        windowsHide: true,
        env: { ...process.env, ...options.env }
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const kill = () => {
        if (!settled) {
          child.kill();
        }
      };

      const tokenRegistration = options.cancellationToken?.onCancellationRequested(kill);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        stdout += chunk;
      });
      child.stderr.on('data', chunk => {
        stderr += chunk;
      });

      child.on('error', error => {
        settled = true;
        tokenRegistration?.dispose();
        reject(error);
      });

      child.on('close', (exitCode, signal) => {
        settled = true;
        tokenRegistration?.dispose();
        const result: GitResult = {
          args,
          cwd,
          stdout,
          stderr,
          exitCode,
          signal,
          durationMs: Date.now() - started
        };
        this.output.git(result);

        if (exitCode === 0 || options.allowNonZeroExit) {
          resolve(result);
          return;
        }

        reject(new GitCliError(this.toHumanError(result), result));
      });

      if (options.input !== undefined) {
        child.stdin.end(options.input, 'utf8');
      }
    });
  }

  async withProgress<T>(title: string, task: (token: vscode.CancellationToken) => Promise<T>): Promise<T> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: true
      },
      async (_progress, token) => task(token)
    );
  }

  private toHumanError(result: GitResult): string {
    const combined = `${result.stderr}\n${result.stdout}`.trim();
    if (/non-fast-forward|fetch first|rejected/i.test(combined)) {
      return 'Push was rejected because the remote branch has new commits. Fetch or pull before pushing.';
    }
    if (/Authentication failed|Permission denied|could not read Username|403|401/i.test(combined)) {
      return 'Git authentication or permission failed. Check your credentials and remote access.';
    }
    if (/not a git repository/i.test(combined)) {
      return 'The selected folder is not a Git repository.';
    }
    if (/conflict|CONFLICT/i.test(combined)) {
      return 'Git stopped because conflicts need to be resolved.';
    }
    return combined || `Git failed with exit code ${result.exitCode ?? 'unknown'}.`;
  }
}
