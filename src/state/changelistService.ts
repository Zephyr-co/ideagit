import * as crypto from 'crypto';
import { Changelist, ChangelistAssignment, ChangelistState, GitChange } from '../models';
import { MetadataStore } from './metadataStore';

export class ChangelistService {
  constructor(private readonly store: MetadataStore) {}

  getState(repositoryRoot: string): ChangelistState {
    return this.store.getChangelistState(repositoryRoot);
  }

  async create(repositoryRoot: string, name: string, description?: string): Promise<Changelist> {
    const state = this.getState(repositoryRoot);
    const now = new Date().toISOString();
    const changelist: Changelist = {
      id: crypto.randomUUID(),
      name,
      description,
      active: false,
      createdAt: now,
      updatedAt: now
    };
    state.changelists.push(changelist);
    await this.store.updateChangelistState(repositoryRoot, state);
    return changelist;
  }

  async rename(repositoryRoot: string, changelistId: string, name: string): Promise<void> {
    const state = this.getState(repositoryRoot);
    const list = state.changelists.find(item => item.id === changelistId);
    if (!list) {
      throw new Error('Changelist was not found.');
    }
    list.name = name;
    list.updatedAt = new Date().toISOString();
    await this.store.updateChangelistState(repositoryRoot, state);
  }

  async delete(repositoryRoot: string, changelistId: string): Promise<void> {
    if (changelistId === 'default') {
      throw new Error('The default changelist cannot be deleted.');
    }
    const state = this.getState(repositoryRoot);
    state.changelists = state.changelists.filter(item => item.id !== changelistId);
    for (const [filePath, assignment] of Object.entries(state.assignments)) {
      if (assignment.changelistId === changelistId) {
        state.assignments[filePath] = { ...assignment, changelistId: 'default', updatedAt: new Date().toISOString() };
      }
    }
    if (state.activeId === changelistId) {
      state.activeId = 'default';
    }
    await this.store.updateChangelistState(repositoryRoot, state);
  }

  async setActive(repositoryRoot: string, changelistId: string): Promise<void> {
    const state = this.getState(repositoryRoot);
    if (!state.changelists.some(list => list.id === changelistId)) {
      throw new Error('Changelist was not found.');
    }
    state.activeId = changelistId;
    for (const list of state.changelists) {
      list.active = list.id === changelistId;
    }
    await this.store.updateChangelistState(repositoryRoot, state);
  }

  async moveChange(repositoryRoot: string, change: GitChange, changelistId: string): Promise<void> {
    const state = this.getState(repositoryRoot);
    if (!state.changelists.some(list => list.id === changelistId)) {
      throw new Error('Changelist was not found.');
    }
    state.assignments[change.path] = this.assignment(changelistId, this.isIncluded(repositoryRoot, change));
    await this.store.updateChangelistState(repositoryRoot, state);
  }

  async setIncluded(repositoryRoot: string, change: GitChange, included: boolean): Promise<void> {
    const state = this.getState(repositoryRoot);
    const existing = state.assignments[change.path];
    const changelistId = existing?.changelistId ?? state.activeId ?? 'default';
    state.assignments[change.path] = this.assignment(changelistId, included);
    await this.store.updateChangelistState(repositoryRoot, state);
  }

  async setIncludedMany(repositoryRoot: string, changes: GitChange[], included: boolean): Promise<void> {
    const selectable = changes.filter(change => !change.ignored);
    if (!selectable.length) {
      return;
    }
    const state = this.getState(repositoryRoot);
    for (const change of selectable) {
      const existing = state.assignments[change.path];
      const changelistId = existing?.changelistId ?? state.activeId ?? 'default';
      state.assignments[change.path] = this.assignment(changelistId, included);
    }
    await this.store.updateChangelistState(repositoryRoot, state);
  }

  getChangelistForChange(repositoryRoot: string, change: GitChange): Changelist {
    const state = this.getState(repositoryRoot);
    const id = state.assignments[change.path]?.changelistId ?? state.activeId;
    return state.changelists.find(list => list.id === id) ?? state.changelists.find(list => list.id === 'default')!;
  }

  getAssignment(repositoryRoot: string, change: GitChange): ChangelistAssignment {
    const state = this.getState(repositoryRoot);
    return state.assignments[change.path] ?? this.assignment(state.activeId, true);
  }

  isIncluded(repositoryRoot: string, change: GitChange): boolean {
    return this.getAssignment(repositoryRoot, change).included;
  }

  pruneMissing(repositoryRoot: string, changes: GitChange[]): void {
    const state = this.getState(repositoryRoot);
    const paths = new Set(changes.map(change => change.path));
    let changed = false;
    for (const filePath of Object.keys(state.assignments)) {
      if (!paths.has(filePath)) {
        delete state.assignments[filePath];
        changed = true;
      }
    }
    if (changed) {
      void this.store.updateChangelistState(repositoryRoot, state);
    }
  }

  private assignment(changelistId: string, included: boolean): ChangelistAssignment {
    return {
      changelistId,
      included,
      updatedAt: new Date().toISOString()
    };
  }
}
