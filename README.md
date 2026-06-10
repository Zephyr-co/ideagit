# ideagit

ideagit 是一款 VS Code 桌面扩展，它在独立的 Activity Bar 视图中提供类似 IntelliJ IDEA 的 Git 工作流体验。

当前 MVP 已实现的能力包括：

- 支持单仓库和多仓库工作区的仓库发现与选择。
- 在本地变更中按本地 changelist 分组，并支持 include/exclude 状态。
- 支持 diff、打开文件、在资源管理器中显示、回滚，以及在 changelist 之间移动文件。
- 支持提交、修正提交，以及带预推送预览的 Commit and Push 流程。
- 支持 Fetch、Pull、Update Project、Push，以及 Force Push With Lease。
- 分支列表提供 checkout、创建、删除、比较、合并和 rebase 入口。
- 日志列表提供详情查看、复制哈希、cherry-pick、revert 和 reset 入口。
- 冲突视图支持 merge、rebase、cherry-pick 状态检测。
- 提供 stash 列表，以及 stash、apply、pop、drop 操作。

扩展内部使用基于参数数组（`spawn`）的单一 Git CLI 服务，并通过共享的风险确认服务处理具有破坏性的操作。

ideagit is a VS Code desktop extension that brings an IntelliJ IDEA inspired Git workflow into a dedicated Activity Bar view.

Implemented MVP capabilities:

- Repository discovery and selection for single and multi-repository workspaces.
- Local Changes grouped by local changelists with include/exclude state.
- Diff, open, reveal, rollback, and changelist file movement actions.
- Commit, amend, and Commit and Push flow with a pre-push preview.
- Fetch, Pull, Update Project, Push, and Force Push With Lease.
- Branch list with checkout, create, delete, compare, merge, and rebase entry points.
- Log list with details, copy hash, cherry-pick, revert, and reset entry points.
- Conflicts view with merge/rebase/cherry-pick state detection.
- Stash list plus stash/apply/pop/drop actions.

The extension uses a single Git CLI service based on argument arrays (`spawn`) and a shared risk-confirmation service for destructive operations.

## 请我喝杯咖啡

如果 ideagit 帮助了你，欢迎请我喝杯咖啡。

<img src="https://raw.githubusercontent.com/Zephyr-co/coffee/main/docs/images/alipay.png" alt="支付宝支持码" width="360">

感谢支持。
