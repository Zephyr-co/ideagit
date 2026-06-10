# VS Code Git 插件需求文档：对齐 IntelliJ IDEA Git 操作体验

## 1. 文档信息

| 项目 | 内容 |
|---|---|
| 产品名称 | ideagit for VS Code，暂定名 |
| 文档版本 | v0.1 |
| 编写日期 | 2026-06-10 |
| 目标平台 | Visual Studio Code Desktop |
| 目标用户 | 熟悉 IntelliJ IDEA Git 操作、希望在 VS Code 中获得近似 Git 工作流的开发者 |
| 参考对象 | IntelliJ IDEA 2026.1 Git / Version Control 相关功能 |

## 2. 背景与目标

VS Code 自带 Git 能力以 Source Control 面板为核心，适合轻量提交、暂存、分支切换等操作。但 IntelliJ IDEA 的 Git 体验更强调完整工作流：本地变更分组 Changelist、提交前检查、可视化 Log、分支上下文操作、Push 预览、冲突处理、Shelf/Stash、Patch、History 等。

本插件目标是在 VS Code 中提供一套接近 IntelliJ IDEA 的 Git 操作体验，让 IDEA 用户迁移到 VS Code 时不需要重新学习 Git 操作入口和流程。

### 2.1 产品目标

1. 在 VS Code 中提供一个独立的 Git 工具窗口，覆盖 IDEA 常用 Git 操作路径。
2. 支持类似 IDEA Changelist 的本地变更分组能力。
3. 提供提交、推送、拉取、分支、合并、变基、挑拣、冲突解决、历史查看等完整 Git 工作流。
4. 在危险操作前提供预览、差异查看、确认和可恢复路径。
5. 尽量复用 VS Code 原生 Git API 和 Git CLI，保证 Git 结果与命令行一致。

### 2.2 非目标

1. 不复刻 IntelliJ IDEA 的所有 UI 细节和视觉样式。
2. 不实现自研 Git 引擎，底层仍依赖本机 Git。
3. 不替代 VS Code 原生 Source Control，而是提供 IDEA 风格增强视图。
4. 首版不覆盖 JetBrains Space、YouTrack、任务管理等 IDE 生态集成。

## 3. 一致性定义

“与 IntelliJ IDEA 里面的 Git 操作一致”在本项目中定义为：

1. 功能一致：常见 Git 操作在插件中有明确入口。
2. 流程一致：用户能按 IDEA 习惯完成“查看变更 -> 分组 -> Diff -> Commit -> Push”等流程。
3. 信息一致：操作前后展示分支、远端、提交、文件差异、冲突状态等关键上下文。
4. 安全一致：Force Push、Reset、Delete Branch、Rebase、Abort 等操作必须有确认和风险提示。
5. 快捷入口一致：重要操作需支持命令面板、右键菜单、工具窗口按钮和快捷键配置。

## 4. 用户画像

### 4.1 IDEA 迁移用户

用户长期使用 IntelliJ IDEA，习惯 Commit 窗口、Local Changes、Changelist、Log、Branch Popup、Shelf 等功能，希望 VS Code 中也能使用类似 Git 入口。

### 4.2 多仓库项目开发者

用户在一个 VS Code Workspace 中打开多个 Git 仓库，需要按仓库查看状态，也需要在部分场景中同步执行 Fetch、Pull、Push。

### 4.3 团队协作开发者

用户需要在提交前执行检查，推送前确认提交内容，处理冲突、Rebase、Cherry-pick、Patch、Stash 等协作操作。

## 5. 信息架构

插件新增 Activity Bar 入口：`ideagit`。

主视图包含以下区域：

1. Repository Selector：仓库选择器，支持单仓库和多仓库。
2. Local Changes：本地变更视图，包含 Changelists、Unversioned Files、Ignored Files。
3. Commit：提交面板，包含提交消息、提交前检查、Commit / Commit and Push。
4. Branches：分支视图，包含 Local、Remote、Favorite、Recent。
5. Log：提交历史视图，包含提交图、筛选器、提交详情、文件列表、Diff。
6. Sync：同步视图，包含 Fetch、Pull、Push、Incoming、Outgoing。
7. Stash / Shelf：临时搁置视图。
8. Conflicts：冲突视图，集中显示未解决冲突和解决入口。

## 6. 功能需求

### 6.1 仓库管理

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-001 | 自动识别当前 Workspace 下所有 Git 仓库。 | P0 |
| R-002 | 支持手动添加已有 Git 仓库路径。 | P1 |
| R-003 | 支持初始化 Git 仓库。 | P1 |
| R-004 | 支持 Clone 远程仓库到本地。 | P1 |
| R-005 | 多仓库场景下提供仓库切换器，并显示当前分支、远端、未提交数量、同步状态。 | P0 |
| R-006 | 支持对全部仓库执行 Fetch。 | P1 |
| R-007 | 支持配置默认仓库排序、隐藏仓库、收藏仓库。 | P2 |

### 6.2 Local Changes 与 Changelist

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-010 | 展示 Modified、Added、Deleted、Renamed、Copied、Untracked、Ignored 文件。 | P0 |
| R-011 | 支持类似 IDEA 的 Changelist：创建、重命名、删除、设为 Active。 | P0 |
| R-012 | 支持将文件或文件内部分块移动到指定 Changelist。 | P1 |
| R-013 | 支持 Changelist 描述，用于保存任务说明或提交意图。 | P1 |
| R-014 | 支持拖拽文件在 Changelist 之间移动。 | P1 |
| R-015 | 支持从右键菜单执行 Show Diff、Open File、Reveal in Explorer、Rollback、Move to Changelist。 | P0 |
| R-016 | 支持按目录、模块、状态、文件类型分组。 | P1 |
| R-017 | 支持显示变更统计：文件数、增删行数、未跟踪文件数。 | P1 |
| R-018 | 支持 Include/Exclude 选择，决定哪些变更进入 Commit。 | P0 |

说明：VS Code 原生 Git 暂存区不能完全等同 IDEA Changelist。插件需要维护一份本地元数据，将文件路径、hunk 选择和 Changelist 关联起来。实际提交时再映射到 Git staging 或临时 index。

### 6.3 Diff 与文件历史

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-020 | 支持文件级 Diff，展示工作区与 HEAD、暂存区与 HEAD、任意两个提交之间差异。 | P0 |
| R-021 | 支持行内 Diff、并排 Diff、忽略空白差异。 | P0 |
| R-022 | 支持单文件 History，展示该文件相关提交。 | P1 |
| R-023 | 支持 Directory History，展示目录范围内提交。 | P1 |
| R-024 | 支持 Annotate / Blame，显示每行最后修改提交、作者、时间。 | P1 |
| R-025 | 支持从 Diff 中回滚单个文件或单个 hunk。 | P1 |

### 6.4 Commit 工作流

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-030 | 提供独立 Commit 面板，显示被选择提交的 Changelist 和文件。 | P0 |
| R-031 | 支持提交整个 Changelist、选中文件、选中 hunk。 | P0 |
| R-032 | 支持提交消息编辑器，并提供最近提交消息历史。 | P0 |
| R-033 | 支持 Amend Commit。 | P0 |
| R-034 | 支持 Commit and Push。 | P0 |
| R-035 | 支持跳过 Git hooks。 | P1 |
| R-036 | 支持 Sign-off。 | P1 |
| R-037 | 支持指定 Author。 | P1 |
| R-038 | 支持 GPG/SSH 签名提交，跟随本机 Git 配置。 | P1 |
| R-039 | 提交前检查：格式化、ESLint/Prettier、TypeScript 检查、测试命令、自定义命令。 | P1 |
| R-040 | 提交前检查失败时阻止提交，并展示错误输出与继续提交选项。 | P1 |
| R-041 | 支持空提交。 | P2 |

### 6.5 Push 工作流

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-050 | Push 前展示 outgoing commits 列表。 | P0 |
| R-051 | 支持查看每个待推送 commit 的详情和 Diff。 | P0 |
| R-052 | 支持选择远端和目标分支。 | P0 |
| R-053 | 支持首次 Push 时设置 upstream。 | P0 |
| R-054 | 支持 Push Tags。 | P1 |
| R-055 | 支持 Force Push，但默认使用 `--force-with-lease`。 | P1 |
| R-056 | Force Push 前必须展示风险说明、远端分支、将被覆盖的提交范围。 | P1 |
| R-057 | Push 失败时解析常见错误：权限、非快进、认证失败、远端不存在、保护分支。 | P1 |

### 6.6 Fetch、Pull 与 Update

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-060 | 支持 Fetch 当前仓库、全部仓库、指定远端。 | P0 |
| R-061 | 支持 Pull，并可配置 merge 或 rebase。 | P0 |
| R-062 | 支持 Update Project 风格的一键同步：Fetch 后按配置 Pull/Rebase。 | P1 |
| R-063 | Pull/Rebase 前检测未提交变更，并提示 Commit、Stash/Shelf、Cancel。 | P0 |
| R-064 | 支持显示 Incoming / Outgoing 提交数量。 | P1 |
| R-065 | 同步完成后显示摘要：新增提交、更新分支、冲突、失败原因。 | P1 |

### 6.7 Branch 分支管理

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-070 | 显示 Local Branches、Remote Branches、Favorite Branches、Recent Branches。 | P0 |
| R-071 | 支持 Checkout、New Branch、Checkout as New Branch。 | P0 |
| R-072 | 支持 Rename Branch、Delete Branch。 | P0 |
| R-073 | 支持 Compare with Current。 | P0 |
| R-074 | 支持 Merge into Current。 | P0 |
| R-075 | 支持 Rebase Current onto Selected。 | P1 |
| R-076 | 支持 Push Branch、Track Remote Branch。 | P1 |
| R-077 | 支持 Copy Branch Name。 | P2 |
| R-078 | 删除未合并分支时必须提示风险。 | P0 |
| R-079 | 切换分支前检测未提交变更，提示保留、迁移、搁置或取消。 | P0 |
| R-080 | 支持创建和切换 Git Worktree。 | P2 |

### 6.8 Merge、Rebase、Cherry-pick

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-090 | 支持 Merge 指定分支到当前分支。 | P0 |
| R-091 | 支持 Squash Merge。 | P1 |
| R-092 | 支持 Rebase 当前分支到指定分支。 | P1 |
| R-093 | Rebase 过程中支持 Continue、Skip、Abort。 | P1 |
| R-094 | 支持从 Log 中 Cherry-pick 一个或多个提交。 | P0 |
| R-095 | Cherry-pick 冲突时进入统一冲突处理流程。 | P0 |
| R-096 | 操作前展示将被合并、变基或挑拣的提交列表。 | P1 |

### 6.9 Log 与历史调查

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-100 | 提供 IDEA 风格 Log 视图：提交图、分支标签、提交列表、详情、文件列表、Diff。 | P0 |
| R-101 | 支持按分支、作者、日期、路径、提交消息、哈希过滤。 | P0 |
| R-102 | 支持显示 Local 与 Remote 分支标签。 | P0 |
| R-103 | 支持右键提交执行 Checkout Revision、Create Branch、Create Tag、Cherry-pick、Revert、Reset Current Branch to Here、Copy Hash。 | P1 |
| R-104 | 支持 Compare Revisions。 | P1 |
| R-105 | 支持选中提交查看提交详情、父提交、完整消息、变更文件和 Diff。 | P0 |
| R-106 | 支持保存常用过滤条件。 | P2 |

### 6.10 冲突解决

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-110 | 检测 Merge、Rebase、Cherry-pick、Pull 产生的冲突文件。 | P0 |
| R-111 | 提供 Conflicts 集中视图，展示冲突文件、冲突来源操作、当前状态。 | P0 |
| R-112 | 支持 Accept Yours、Accept Theirs、Merge Manually。 | P0 |
| R-113 | 集成 VS Code 三方合并编辑器。 | P0 |
| R-114 | 解决冲突后支持 Mark as Resolved。 | P0 |
| R-115 | 支持 Abort Merge、Abort Rebase、Abort Cherry-pick。 | P0 |
| R-116 | 操作结束后回到 Commit 或 Continue Rebase/Cherry-pick 流程。 | P1 |

### 6.11 Stash 与 Shelf

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-120 | 支持 Git Stash：stash、stash with message、apply、pop、drop、branch from stash。 | P0 |
| R-121 | 支持类似 IDEA Shelf 的搁置区，用于保存未提交变更快照。 | P1 |
| R-122 | Shelf 支持命名、描述、查看 Diff、恢复部分文件、删除。 | P1 |
| R-123 | 在切换分支、Pull/Rebase 前可一键 Stash 或 Shelf 当前变更。 | P1 |
| R-124 | 支持将 Shelf 导出为 Patch。 | P2 |

说明：Stash 使用 Git 原生命令。Shelf 是插件增强能力，可使用 patch 文件和元数据实现。

### 6.12 Patch

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-130 | 支持从 Changelist、文件、提交生成 Patch。 | P1 |
| R-131 | 支持应用 Patch，并在应用前预览变更。 | P1 |
| R-132 | Patch 应用冲突时进入冲突处理流程。 | P1 |

### 6.13 Tag

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-140 | 支持创建 lightweight tag 和 annotated tag。 | P1 |
| R-141 | 支持删除本地 tag。 | P1 |
| R-142 | 支持 Push 指定 tag 或全部 tags。 | P1 |
| R-143 | 支持从 Log 中按 tag 过滤提交。 | P2 |

### 6.14 Rollback、Reset、Revert

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-150 | 支持回滚未提交文件变更。 | P0 |
| R-151 | 支持回滚单个 hunk。 | P1 |
| R-152 | 支持 Revert 一个或多个提交。 | P1 |
| R-153 | 支持 Reset Current Branch to Here：Soft、Mixed、Hard、Keep。 | P1 |
| R-154 | Hard Reset 前必须二次确认，并展示将丢失的本地变更。 | P0 |

### 6.15 远端管理

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-160 | 展示 remotes 列表和 URL。 | P1 |
| R-161 | 支持 Add、Edit、Remove Remote。 | P1 |
| R-162 | 支持 Copy Remote URL。 | P2 |
| R-163 | Push/Pull 时可切换 remote。 | P0 |

### 6.16 设置与个性化

| 编号 | 需求 | 优先级 |
|---|---|---|
| R-170 | 支持配置 Pull 策略：merge、rebase、ff-only。 | P0 |
| R-171 | 支持配置 Commit 前检查项。 | P1 |
| R-172 | 支持配置默认 Changelist 行为。 | P1 |
| R-173 | 支持配置日期格式、作者显示格式、提交图密度。 | P2 |
| R-174 | 支持配置危险操作确认策略。 | P1 |
| R-175 | 支持快捷键绑定。 | P0 |

## 7. 交互需求

### 7.1 工具窗口

插件在 Activity Bar 增加专用入口。工具窗口布局应尽量接近 IDEA 的使用心智：

1. 左侧或上方是仓库与分支状态。
2. Local Changes 聚焦未提交变更。
3. Log 聚焦已提交历史。
4. 操作入口优先放在上下文菜单，其次是工具栏按钮。

### 7.2 右键菜单

不同对象需要有对应上下文菜单：

| 对象 | 常用动作 |
|---|---|
| 文件变更 | Diff、Open、Rollback、Move to Changelist、Stage、Unstage |
| Changelist | Commit、Rename、Delete、Set Active、Move Changes |
| 分支 | Checkout、New Branch from Here、Compare、Merge、Rebase、Delete、Push |
| 提交 | Show Diff、Cherry-pick、Revert、Create Branch、Create Tag、Reset to Here |
| Stash/Shelf | Apply、Pop、Drop、Show Diff、Create Branch |

### 7.3 状态栏

状态栏显示：

1. 当前仓库。
2. 当前分支。
3. ahead / behind 数量。
4. dirty 文件数量。
5. 当前 Git 操作状态，例如 Rebase in progress。

### 7.4 通知与确认

以下操作必须弹出确认：

1. Force Push。
2. Hard Reset。
3. 删除未合并分支。
4. 丢弃未提交变更。
5. Abort Rebase / Merge / Cherry-pick。
6. 删除 Stash / Shelf。

确认内容必须包含操作对象、影响范围和可恢复性说明。

## 8. 数据与状态设计

### 8.1 本地元数据

插件需要维护以下元数据：

1. Changelist 定义：ID、名称、描述、是否 Active。
2. 文件到 Changelist 的映射。
3. Shelf 数据：名称、描述、patch 路径、创建时间、关联仓库。
4. 用户偏好：收藏分支、最近分支、过滤器、视图布局。

建议存储位置：

1. Workspace 级状态：VS Code `workspaceState` 或 `.vscode` 下插件专用文件。
2. 全局偏好：VS Code `globalState`。
3. Shelf/Patch 大文件：插件 global storage 或 workspace storage。

### 8.2 Git 状态刷新

1. 文件变更监听需要防抖，避免大型仓库频繁刷新。
2. Git 操作执行后必须刷新相关视图。
3. Log 视图应分页加载，避免一次加载全部提交。
4. 多仓库状态刷新应并发但有限流。

## 9. 命令清单

插件至少注册以下命令：

| 命令 ID | 命令名称 |
|---|---|
| `ideagit.showLocalChanges` | Show Local Changes |
| `ideagit.showLog` | Show Git Log |
| `ideagit.commit` | Commit |
| `ideagit.commitAndPush` | Commit and Push |
| `ideagit.push` | Push |
| `ideagit.pull` | Pull |
| `ideagit.fetch` | Fetch |
| `ideagit.updateProject` | Update Project |
| `ideagit.createChangelist` | Create Changelist |
| `ideagit.moveToChangelist` | Move to Changelist |
| `ideagit.rollback` | Rollback |
| `ideagit.checkoutBranch` | Checkout Branch |
| `ideagit.createBranch` | Create Branch |
| `ideagit.merge` | Merge |
| `ideagit.rebase` | Rebase |
| `ideagit.cherryPick` | Cherry-pick |
| `ideagit.stash` | Stash Changes |
| `ideagit.shelf` | Shelf Changes |
| `ideagit.resolveConflicts` | Resolve Conflicts |

## 10. MVP 范围

首版建议聚焦最能体现 IDEA 体验差异的能力。

### 10.1 P0 必做

1. 仓库识别与切换。
2. Local Changes 视图。
3. Changelist 创建、移动文件、Active Changelist。
4. Diff、Rollback。
5. Commit、Amend、Commit and Push。
6. Push 前 outgoing commits 预览。
7. Fetch、Pull。
8. Branch 列表、Checkout、Create、Delete、Merge、Compare。
9. Log 视图基础能力。
10. 冲突检测与 VS Code 合并编辑器集成。
11. Stash 基础能力。
12. 危险操作确认。

### 10.2 P1 下一阶段

1. 提交前检查。
2. Rebase 完整流程。
3. Cherry-pick 多提交。
4. Shelf。
5. Patch。
6. Blame / Annotate。
7. Remote 管理。
8. Tag。
9. 多仓库同步操作。

### 10.3 P2 增强

1. Worktree。
2. 保存 Log 过滤器。
3. 视图布局个性化。
4. AI 辅助生成提交消息。
5. Issue / Task 集成。

## 11. 验收标准

### 11.1 核心流程验收

1. 用户可以在一个 VS Code Workspace 中打开 Git 仓库，并在插件入口看到当前分支和本地变更。
2. 用户可以创建两个 Changelist，将不同文件移动到不同 Changelist，并分别提交。
3. 用户可以在提交前查看 Diff、填写提交消息、执行 Commit and Push。
4. 用户 Push 前可以看到 outgoing commits，并查看某个 commit 的文件差异。
5. 用户可以从 Branch 视图新建分支、切换分支、删除分支、合并分支。
6. 用户可以在 Log 视图过滤提交、查看提交详情、执行 Cherry-pick 或 Revert。
7. 用户在 Pull 产生冲突后，可以从 Conflicts 视图打开 VS Code 合并编辑器并完成冲突解决。
8. 用户执行 Force Push、Hard Reset、Rollback 前会看到明确确认。

### 11.2 兼容性验收

1. 支持 Windows、macOS、Linux。
2. 支持 Git 2.30 及以上版本。
3. 支持单仓库和多仓库 Workspace。
4. 支持 GitHub、GitLab、Gitea、Bitbucket 等标准 Git 远端。
5. 不破坏 VS Code 原生 Source Control 操作。

### 11.3 性能验收

1. 1 万文件规模仓库下，Local Changes 首次展示不超过 3 秒。
2. Log 首屏加载不超过 2 秒，后续分页加载。
3. 文件状态变化后 1 秒内刷新视图。
4. 长耗时 Git 操作必须显示进度并允许取消。

## 12. 技术约束与建议

1. 优先使用 VS Code Extension API 和内置 Git 扩展 API。
2. Git 操作统一封装为服务层，避免 UI 直接调用 shell。
3. 对复杂 Git 命令保留完整 stdout、stderr，用于错误解析和问题排查。
4. 所有破坏性命令必须经过统一风险确认模块。
5. Changelist 和 Shelf 是插件增强层，不应修改 Git 仓库历史或用户配置。
6. 对路径、分支名、提交消息等输入做转义，避免 shell 注入。
7. 尽量使用 spawn 参数数组执行 Git，而不是拼接命令字符串。

## 13. 风险与待确认问题

| 风险 | 说明 | 建议 |
|---|---|---|
| Changelist 与 Git staging 模型不完全一致 | IDEA Changelist 是 IDE 层概念，VS Code/Git 没有完全等价模型。 | 插件维护 Changelist 元数据，提交时临时映射到 index。 |
| 大仓库性能 | Log、status、diff 可能较慢。 | 分页、缓存、防抖、增量刷新。 |
| 多仓库操作风险 | 一键 Pull/Push 多仓库容易误操作。 | 默认只操作当前仓库，多仓库操作需明确确认。 |
| Rebase/Cherry-pick 中断状态复杂 | 用户可能在命令行或 VS Code 原生 Git 中继续操作。 | 每次刷新读取 `.git` 状态，界面以真实 Git 状态为准。 |
| 与原生 Git 扩展冲突 | 两套 Git UI 可能状态不一致。 | 操作后统一刷新，并避免覆盖用户原生配置。 |

待确认问题：

1. 插件是否需要完全中文界面，还是中英双语？
2. 是否需要兼容 VS Code Web？如果需要，部分 Git CLI 能力不可用。
3. Changelist 元数据是否允许写入项目 `.vscode`，还是只能存在用户本机？
4. 提交前检查是否复用项目脚本，例如 `npm test`、`pnpm lint`、`mvn test`？
5. 是否需要与 GitHub Pull Request / GitLab Merge Request 集成？

## 14. 参考资料

1. [JetBrains IntelliJ IDEA Git 文档](https://www.jetbrains.com/help/idea/using-git-integration.html)
2. [Commit and push changes to Git repository](https://www.jetbrains.com/help/idea/commit-and-push-changes.html)
3. [Group changes into changelists](https://www.jetbrains.com/help/idea/managing-changelists.html)
4. [Manage Git branches](https://www.jetbrains.com/help/idea/manage-branches.html)
5. [Investigate changes in Git repository](https://www.jetbrains.com/help/idea/investigate-changes.html)
6. [Resolve Git conflicts](https://www.jetbrains.com/help/idea/resolve-conflicts.html)
7. [Sync with a remote Git repository](https://www.jetbrains.com/help/idea/sync-with-a-remote-repository.html)
8. [Apply changes from one Git branch to another](https://www.jetbrains.com/help/idea/apply-changes-from-one-branch-to-another.html)
9. [Shelve and unshelve changes](https://www.jetbrains.com/help/idea/shelving-and-unshelving-changes.html)
10. [Use patches](https://www.jetbrains.com/help/idea/using-patches.html)
