import { BranchInfo, ChangeStatus, CommitInfo, GitChange, StashInfo } from '../models';

const conflictStatuses = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);

export function parsePorcelainStatus(repositoryRoot: string, output: string): GitChange[] {
  const lines = output.split('\0').filter(Boolean);
  const changes: GitChange[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const record = lines[index];
    if (record.startsWith('# ')) {
      continue;
    }
    if (record.length < 4) {
      continue;
    }

    const indexStatus = record[0] ?? ' ';
    const workingTreeStatus = record[1] ?? ' ';
    const statusPair = `${indexStatus}${workingTreeStatus}`;
    let filePath = record.slice(3);
    let originalPath: string | undefined;

    if (indexStatus === 'R' || indexStatus === 'C') {
      originalPath = lines[index + 1];
      index += 1;
    }

    if (filePath.startsWith('"') && filePath.endsWith('"')) {
      filePath = filePath.slice(1, -1);
    }

    changes.push({
      repositoryRoot,
      path: filePath,
      originalPath,
      indexStatus,
      workingTreeStatus,
      status: toChangeStatus(indexStatus, workingTreeStatus),
      staged: indexStatus !== ' ' && indexStatus !== '?' && indexStatus !== '!',
      untracked: statusPair === '??',
      ignored: statusPair === '!!',
      conflicted: conflictStatuses.has(statusPair)
    });
  }

  return changes;
}

export function parseBranchList(output: string): BranchInfo[] {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      const [head, fullRef, shortRef, upstream] = line.split('\t');
      const type: BranchInfo['type'] = fullRef?.startsWith('refs/remotes/') ? 'remote' : 'local';
      const name = shortRef;
      return {
        name,
        type,
        current: head === '*',
        upstream: upstream || undefined
      };
    })
    .filter(branch => branch.name && branch.name !== 'origin/HEAD' && !branch.name.includes(' -> '));
}

export function parseCommitLog(output: string): CommitInfo[] {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      const [hash, shortHash, author, date, refs, ...subjectParts] = line.split('\x1f');
      return {
        hash,
        shortHash,
        author,
        date,
        refs: refs || undefined,
        subject: subjectParts.join('\x1f')
      };
    })
    .filter(commit => commit.hash);
}

export function parseStashList(output: string): StashInfo[] {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      const [selector, branch, ...messageParts] = line.split('\x1f');
      return {
        selector,
        branch: branch || undefined,
        message: messageParts.join('\x1f')
      };
    });
}

function toChangeStatus(indexStatus: string, workingTreeStatus: string): ChangeStatus {
  const pair = `${indexStatus}${workingTreeStatus}`;
  if (conflictStatuses.has(pair)) {
    return 'conflicted';
  }
  if (pair === '??') {
    return 'untracked';
  }
  if (pair === '!!') {
    return 'ignored';
  }
  if (indexStatus === 'R' || workingTreeStatus === 'R') {
    return 'renamed';
  }
  if (indexStatus === 'C' || workingTreeStatus === 'C') {
    return 'copied';
  }
  if (indexStatus === 'A' || workingTreeStatus === 'A') {
    return 'added';
  }
  if (indexStatus === 'D' || workingTreeStatus === 'D') {
    return 'deleted';
  }
  if (indexStatus === 'M' || workingTreeStatus === 'M') {
    return 'modified';
  }
  return 'unknown';
}
