---
name: hof-tech-debt-audit
description: Hall-of-Fame-Studio 专属的技术债审计与清理流程。当用户要求排查技术债、审计代码质量、修复 agent 协作系统 bug、补齐文档或重建项目认知时使用。包含项目架构地图、已知债务热点、审计工作流和文档产出规范。
---

# Hall-of-Fame-Studio 技术债审计

## 项目架构地图（先读这个建立认知）

```
前端: src/main.jsx → src/App.jsx (~38k 行, 巨石)
        ↓ fetch (VITE_AGENT_BACKEND_URL, 默认 127.0.0.1:8787)
后端: scripts/agent-project-server.mjs (~270 行, 启动入口)
        → src/agents/agentProjectHttpServer.js
        → src/agents/agentProjectApi.js (~3.3k 行, 路由层)
        → src/agents/agentProjectService.js (~62k 行, 巨石, 全部业务逻辑)
            → src/agents/agentRuntime.js (~3.4k 行, 会议/自治协作引擎)
            → src/agents/localProjectRuntime.js (文件沙箱)
            → src/agents/modelProvider.js (LLM 适配) / secretVault.js (密钥库)
状态存储: JSON 文件 (AGENT_PROJECT_STORE), 工作区在 .tmp/agent-projects/
```

已知债务热点（按优先级）：
1. `src/agents/agentProjectService.js` ~62k 行 —— 业务逻辑、schema 构建、receipt 生成混在一起
2. `src/App.jsx` ~38k 行 —— 全部 UI 在一个文件，Babel 已警告超 500KB
3. 无单元测试 —— 只有 85+ 个 `scripts/validate-*.mjs`（静态断言 + Playwright），脆弱且慢
4. Mock/真实边界 —— 靠 `validate-frontend-mock-boundaries.mjs` (~3.1k 行) 强制，参考 `docs/FRONTEND_MOCK_REPLACEMENT_REGISTER.md`
5. 重复工具函数（如 `parseBoolean`）散落多文件

## 审计工作流

复制此清单并跟踪进度：

```
- [ ] 阶段 0: 固定基线 —— 提交/暂存当前变更, 确认 npm run agents:server + dev 可跑通
- [ ] 阶段 1: Bug 分类 —— 每个 bug 记入 docs/BUG_LOG.md, 用 systematic-debugging skill 定根因
- [ ] 阶段 2: 债务盘点 —— 产出 docs/TECH_DEBT_REGISTER.md（见下方模板）
- [ ] 阶段 3: 架构文档 —— 产出 docs/ARCHITECTURE.md（模块图 + 数据流 + API 参考）
- [ ] 阶段 4: 安全网 —— 为将拆分的模块补 node:test 单元测试, 再动刀
- [ ] 阶段 5: 渐进拆分 —— 每次只拆一个领域, 拆后跑对应 validate 脚本 + 单测
```

### 阶段规则

- **先测试后重构**：任何对 `agentProjectService.js` / `App.jsx` 的拆分，必须先给该领域写特征测试（characterization test），用 `node --test` 即可，不引入新框架。
- **拆分粒度**：按领域拆（projects / meetings / chat / autonomy / evidence / settings），每次 PR 只动一个领域，拆完立刻跑：
  - 对应的 `npm run agents:*` validate 脚本
  - `npm run build`（确认 Vite 可构建）
- **不重写，只搬运**：拆分时逐字搬运函数，禁止顺手"优化"逻辑；行为变化必须单独提交。
- **每个修复的 bug** 必须在 `docs/BUG_LOG.md` 留档：现象、根因、修复 commit、防回归手段。

## 文档产出规范

### docs/TECH_DEBT_REGISTER.md 模板

```markdown
# 技术债登记册
| ID | 位置 | 描述 | 影响 | 严重度 | 状态 | 处理计划 |
|----|------|------|------|--------|------|----------|
| TD-001 | src/agents/agentProjectService.js | 62k 行巨石 | 无法测试/易冲突 | P0 | open | 按领域拆分 |
```

### docs/BUG_LOG.md 模板

```markdown
## BUG-001: <一句话现象>
- 复现步骤:
- 根因:
- 修复: <commit hash / PR>
- 防回归: <测试文件 / validate 脚本>
```

### docs/ARCHITECTURE.md 要求

- 模块依赖图（mermaid）
- 每个 HTTP 端点：方法、路径、请求/响应形状、对应 service 函数
- 数据存储格式（AGENT_PROJECT_STORE JSON 结构）
- 前端与后端的 mock 边界现状（链接到 FRONTEND_MOCK_REPLACEMENT_REGISTER.md）

## 配套 skill（已安装在 .agents/skills/）

| Skill | 何时用 |
|-------|--------|
| systematic-debugging | 排查每个 bug 时（先证据后假设） |
| diagnosing-bugs | 快速定位根因 |
| triage | 一堆 bug 时排优先级 |
| improve-codebase-architecture | 规划巨石拆分方案 |
| tdd | 拆分前补测试 |
| writing-plans / executing-plans | 长周期重构分解为可执行计划 |
| verification-before-completion | 每步完成前自检 |
| zoom-out | 陷入细节时回看全局 |

## 验证命令速查

- 启动后端: `npm run agents:server`
- 启动前端: `npm run dev`
- 发布门禁: `npm run launch:gates`
- Mock 边界: `node scripts/validate-frontend-mock-boundaries.mjs`
- 端到端: `scripts/validate-real-user-zero-to-autonomy-agents-server-{api,ui}.mjs`
