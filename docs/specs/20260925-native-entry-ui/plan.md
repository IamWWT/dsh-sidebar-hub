---
title: 设计与契约
type: specification
status: active
version: 0.1.2
date: 2026-09-25
---

## 当前状态

- 文档性质：规格（设计与契约）
- 对应版本：v0.1.3
- 状态：有效
- 维护者：AI + 用户

基线：DSH 0.1.7-rc.1 / 46a7f68b09。

保留官方 guide provider 的完整入口，恢复终端 shell 下拉；分类拖拽仍由 Hub 管理。

Hub：registry.guide 的 providerId/id 完整进入分类快照；声明 keyed 子插槽 sidebar.right.tab.guide.entry，传递 useTabInfo hookContext；无 provider 的普通入口用 Hub 按钮。
Switch：ModuleLoader 平台模块 @deepseek-ai/dsh-client-ui-primitives 的 Menu，通过依赖注入传给组件；side=top/align=end/portal/autoFocus；命令通道保持不变。

回滚：回退本次插件改动并重建；不还原其他人的锁文件或整个 profile。
