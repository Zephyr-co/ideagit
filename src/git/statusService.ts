import { GitChange } from '../models';
import { GitCliService } from './gitCliService';
import { parsePorcelainStatus } from './gitParsers';

export class StatusService {
  constructor(private readonly git: GitCliService) {}

  async getChanges(repositoryRoot: string, includeIgnored = true): Promise<GitChange[]> {
    const args = includeIgnored
      ? ['status', '--porcelain=v1', '-z', '--ignored=matching']
      : ['status', '--porcelain=v1', '-z'];
    const result = await this.git.run(repositoryRoot, args);
    return parsePorcelainStatus(repositoryRoot, result.stdout);
  }
}
