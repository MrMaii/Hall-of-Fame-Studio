# Contributing to Hall of Fame Studio

感谢你对本项目的关注。在开始之前，请务必阅读 **[ROADMAP.md](ROADMAP.md)**。

## 重要声明

- 本项目处于 **Pre-alpha**，**不可用于生产或真实业务**。
- **安全机制尚未建立**，请勿接入敏感 API Key 或机密数据。
- 本地 `npm run dev` 仅用于开发预览，不代表产品可用。

## 当前欢迎的贡献方向

按优先级排序：

1. **M1 — 人物 Skill 包**  
   完善 `skills/hall-of-fame-personas/source/personas/{slug}/`，确保 `npm run skills:check` 通过。

2. **M2 — Agent 协作机制**  
   补充 scenario 测试、文档化会议/群聊/治理规则，改进 `src/agents/` 下的协议与诊断。

3. **M3 — 运行算法**  
   扩展 runtime 验证脚本，文档化 `agentRuntime.js` 的输入输出契约。

**暂不接受以「让产品立刻可对外商用」为目标的 PR**，除非对应里程碑在 ROADMAP 中已标记完成。

## 开发环境

```bash
git clone https://github.com/MrMaii/Hall-of-Fame-Studio.git
cd Hall-of-Fame-Studio
npm install
npm run dev
```

验证改动：

```bash
npm run skills:check
npm run agents:scenario
npm run build
```

## 提交 PR 时请说明

- 针对 ROADMAP 的哪个里程碑（M1 / M2 / M3）
- 如何验证（命令与预期结果）
- 是否涉及人物 Skill 内容变更（若是，注明 slug）

## 行为准则

- 尊重开源协作，PR 描述清晰、改动范围聚焦。
- 不要提交 API Key、`.env` 或任何凭据。
- 人物 Skill 内容应原创或注明来源，避免侵权。

详细进程与阶段定义见 **[ROADMAP.md](ROADMAP.md)**。
