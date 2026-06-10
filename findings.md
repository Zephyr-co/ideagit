# Findings: IntelliJ IDEA Git Workflow

## Source Notes
- JetBrains 2026.1 Git overview lists the core IntelliJ IDEA Git workflow as repository setup, update branch/project, commit and push, merge/rebase/cherry-pick, and conflict resolution.
- Commit workflow is centered on the Commit tool window: select files or whole changelist, include unversioned files in one step, optionally amend, enter/reuse commit messages, run commit checks, and choose Commit or Commit and Push.
- IntelliJ IDEA supports commit checks such as formatting, import optimization, cleanup/inspection, malicious dependency checks, hooks control, sign-off, author override, and advanced checks.
- Push workflow includes reviewing outgoing commits, defining/remapping remotes and target branches, previewing commit changes before push, pushing tags, and safer force push behavior based on `--force-with-lease`.
- Changelists are local uncommitted-change groups. Users can create many changelists, set one active, move changes between changelists, attach descriptions/comments, preserve task context, and drag files between lists.
- Log tab has branches, commits, changed files, and commit details panes. Branches pane supports checkout, new branch, delete, compare, fetch/update, favorites, branch filters, rebase, merge, and worktree creation.
- Commit list supports graph/labels, local/remote/current branch visibility, author/time/hash/message metadata, filters by text, branch, user, date, and path/root.
- Verified the official JetBrains reference URLs used in the requirements document return HTTP 200 on 2026-06-10.

## Product Implications
- The VS Code extension should provide an IDEA-like Git tool window rather than only relying on the native Source Control panel.
- Changelist-like grouping is a first-class requirement because VS Code Git staging alone does not fully match IntelliJ IDEA's task-oriented grouping model.
- Commit, push, log, branch, diff, and conflict flows should expose preview and context before destructive or shared operations.
- Multi-repository workspaces need explicit repository selection and optional synchronized repository control.

## Created Artifact
- `ideagit-requirements.md`: Chinese PRD-style requirements document for the VS Code Git extension.
