import * as vscode from 'vscode';
import { ChangelistState, defaultChangelist } from '../models';
import { repositoryStorageKey } from '../utils/pathUtils';

export class MetadataStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getChangelistState(repositoryRoot: string): ChangelistState {
    const key = this.key(repositoryRoot);
    const existing = this.context.workspaceState.get<ChangelistState>(key);
    if (existing?.version === 1 && existing.changelists.length > 0) {
      return this.normalize(existing);
    }
    const initial = this.initialState();
    void this.context.workspaceState.update(key, initial);
    return initial;
  }

  async updateChangelistState(repositoryRoot: string, state: ChangelistState): Promise<void> {
    await this.context.workspaceState.update(this.key(repositoryRoot), this.normalize(state));
  }

  private key(repositoryRoot: string): string {
    return `changelists:${repositoryStorageKey(repositoryRoot)}`;
  }

  private initialState(): ChangelistState {
    const list = defaultChangelist();
    return {
      version: 1,
      activeId: list.id,
      changelists: [list],
      assignments: {}
    };
  }

  private normalize(state: ChangelistState): ChangelistState {
    const now = new Date().toISOString();
    const hasDefault = state.changelists.some(list => list.id === 'default');
    const changelists = hasDefault ? state.changelists : [defaultChangelist(now), ...state.changelists];
    const activeId = changelists.some(list => list.id === state.activeId) ? state.activeId : 'default';
    return {
      version: 1,
      activeId,
      changelists: changelists.map(list => ({ ...list, active: list.id === activeId })),
      assignments: state.assignments ?? {}
    };
  }
}
