# Task Plan: ideagit VS Code Extension Implementation

## Goal
Implement a usable VS Code desktop extension from `ideagit-requirements.md`, focused on the P0/MVP IntelliJ IDEA-like Git workflow.

## Phases

| Phase | Status | Notes |
|---|---|---|
| 1. Workspace and implementation plan | complete | Existing folder only had requirements/planning docs; created an extension project plan. |
| 2. Extension manifest and project scaffolding | complete | Added `package.json`, TypeScript config, VS Code launch/tasks, README, icon, and source folders. |
| 3. Core Git services and state | complete | Added spawn-based Git CLI service, repository discovery, status parsing, changelist metadata, risk confirmation, and Git operation services. |
| 4. Views and webviews | complete | Added repositories, local changes, sync, branches, log, conflicts, stash, commit, and push preview UI surfaces. |
| 5. Commands and workflow wiring | complete | Command registry connects UI to Git services; public and internal commands are registered. |
| 6. Verification and audit | complete | `npm run compile`, `npm run check`, command coverage, ASCII scan, and shell/exec scan passed. |

## Decisions
- Build a real TypeScript VS Code extension, not a mockup.
- Keep MVP scope centered on P0 flows: repository selection, Local Changes/Changelist, diff/rollback, commit, push preview, fetch/pull, branches, log, conflicts, and stash.
- Use `spawn` with argument arrays through a single `GitCliService`; UI and commands do not shell out directly.
- Store changelist metadata in VS Code `workspaceState` by repository identity to avoid modifying Git history or project files.
- Route destructive operations through `RiskConfirmationService`.
- Preserve ASCII source text unless existing files require non-ASCII.

## Parallel Review Findings Incorporated
- Hard gates from review: unified Git service, argument-array Git calls, dangerous-operation confirmations, and changelist commit behavior that restores previous staged state.
- P0 coverage list from review is being used as the implementation checklist.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| `create_goal` failed because a goal already existed | Goal setup | Continued under existing active goal. |
| Initial PowerShell `node --version; npm --version; git --version` timed out | Environment check | Checked executable paths individually; Node, npm, and Git are available. |
| First TypeScript compile found narrow node context types and QuickPick generic misuse | Compile 1 | Widened node context handling and changed reset mode selection typing. |
| Direct Node smoke test against compiled services failed because VS Code extension modules require the `vscode` host module | Service smoke test | Switched to an equivalent Git CLI strategy test for the temp-index changelist commit behavior. |
