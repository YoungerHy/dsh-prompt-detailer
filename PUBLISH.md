# 发布清单：从本地插件到 DSH 插件市场

这份清单把 `dsh-prompt-detailer` 发到 **npm + GitHub + dsh-plugin.org 社区市场**。全程不需要改 DSH 源码。

> 仓库地址已按 `YoungerHy` 填好；如果之后改 GitHub 用户名，记得同步 `package.json`、`README.md`、本文件。
> 包名 `dsh-prompt-detailer` 在 2026-11-13 查询时可用；发布前再查一次：<https://registry.npmjs.org/dsh-prompt-detailer>。

---

## 0. 先确认：公开发的是什么

| 内容 | 是否公开 |
|---|---|
| `index.js` / `client.js` / `cordis.patch.yml` / `icon.svg` / `locale` | ✅ 公开 |
| 任意 OpenAI 兼容后端的配置能力 | ✅ 公开 |
| 你本机的 `~/.dsh/prompt-detailer/config.json` | ❌ 绝不提交（含 API Key） |
| 豆包 Cookie / `doubao-free-api` / Quicker Relay 等本机私有配置 | ❌ 不放进公开仓库 |

公开版只负责「把草稿发给一个 OpenAI 兼容接口，再把结果填回输入框」，不绑定豆包，也不包含任何逆向/抓 Cookie 代码。

---

## 1. 本地自检

```powershell
cd E:\杂类\dsh-prompt-detailer

# 纯 JS，无构建步骤
node --check index.js
node --check client.js

# 看打包内容（不会真的发布）
npm pack --dry-run
```

确认 `npm pack --dry-run` 的输出里包含：

- `index.js`
- `client.js`
- `cordis.patch.yml`
- `locale/zh.json`、`locale/en.json`
- `icon.svg`
- `README.md`
- `LICENSE`

**不应包含**：`config.json`、`.env`、`node_modules`、任何本地绝对路径、任何 Cookie/Key。

再在一个干净的 profile 里装一次，确认真能跑：

```powershell
dsh plugin --profile web add E:\杂类\dsh-prompt-detailer
# 重启 DSH，打开网页，确认输入框右侧出现「✨ 细化」
# 在浮层里配置一个后端，跑一次「开始细化」
```

---

## 2. 建 GitHub 公开仓库

```powershell
cd E:\杂类\dsh-prompt-detailer
git init
git add .
git commit -m "feat: initial prompt detailer plugin"
git branch -M main
git remote add origin https://github.com/YoungerHy/dsh-prompt-detailer.git
git push -u origin main
```

在 GitHub 仓库设置里：

1. **Topics** 添加 `dsh-plugin`
2. Description 写一句价值，例如：  
   `Turn a rough request into a detailed prompt with any OpenAI-compatible model, then send it to the DSH agent.`
3. 打个 Release：`v0.1.0`，标题与 `package.json` 版本一致
4. 确认 README 里有**可复制的安装命令**

---

## 3. 发布到 npm

先登录（只需一次）：

```powershell
npm login
npm whoami
```

发布：

```powershell
cd E:\杂类\dsh-prompt-detailer
npm publish --access public
```

验证：

```powershell
npm view dsh-prompt-detailer version
npm view dsh-prompt-detailer dist.tarball
```

然后换一台机器 / 干净 profile 验证一键安装：

```powershell
dsh plugin --profile web add dsh-prompt-detailer
```

> 以后发新版：改 `package.json` 的 `version` → `npm publish` → GitHub Release `vX.Y.Z`。
> 不要重复发布同一个版本号；npm 不允许覆盖。

---

## 4. 提交到 DSH 社区插件市场

市场地址：<https://dsh-plugin.org/zh/submit>

收录要求（官方页面）：

- 公开仓库
- GitHub topic `dsh-plugin`
- README 含安装命令 `dsh plugin --profile web add <包名>`
- 插件导出 `apply(ctx)` 模块
- 仓库根目录有 `package.json`
- 想出现在 DSH 内的「插件中心」，必须发布 npm 包

提交 Issue（模板已预填）：

<https://github.com/dshplugin/dsh-plugin-hub/issues/new?title=%5B%E6%8F%92%E4%BB%B6%E6%8F%90%E4%BA%A4%5D%20%3Cowner%3E%2F%3Crepo%3E%20%E2%80%94%20%3C%E4%B8%80%E5%8F%A5%E8%AF%9D%E4%BB%B7%E5%80%BC%3E>

按下面内容填：

```markdown
### 仓库地址
https://github.com/YoungerHy/dsh-prompt-detailer

### 一句话价值
在 DSH 输入框点一下，先用任意 OpenAI 兼容模型把粗需求写成详细提示词，再交给主 Agent 执行，少返工、省 token。

### 能力分类
工具与能力

### 安装命令
dsh plugin --profile web add dsh-prompt-detailer

### 兼容与运行要求
DSH 0.2.x；Node 18+；需要一个 OpenAI 兼容的 /chat/completions 接口（火山方舟 / OpenAI / Ollama / 本地网关均可）。

### 许可证
MIT

### 截图 / 演示
（附 README 里的截图或 15 秒演示 GIF）

### 补充说明
插件不上传数据，不包含遥测；API Key 仅保存在本机 ~/.dsh/prompt-detailer/config.json。
```

收录后可以把徽章加到 README：

```markdown
[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/YoungerHy/dsh-prompt-detailer)
```

---

## 5. 发布节奏建议

1. **v0.1.0**：能装、能细化、能填入/发送；README + 1 张截图
2. **v0.1.1**：修第一次用户反馈（模型兼容、错误提示）
3. **v0.2.0**：加一个明显的新能力（例如流式预览 / 多模板 / 历史记录）
4. 每次发版同步：npm version、GitHub Release、市场自动刷新（无需重复提交）

---

## 6. 绝对不要提交的东西

- `~/.dsh/prompt-detailer/config.json`（含 API Key）
- 任何 `cookie` / `sessionid` / `authorization` / `.env`
- `E:\...` 这种本机绝对路径写进 `package.json` 的 `dependencies`（发布版必须是 npm 依赖或零依赖）
- `private: true`（发布前已移除）
- 带个人对话内容的截图（发布前打码/换 demo 工作区）

---

## 7. 发布后检查

- [ ] `npm view dsh-prompt-detailer` 能看到版本
- [ ] 新机器 `dsh plugin --profile web add dsh-prompt-detailer` 成功
- [ ] 输入框出现「✨ 细化」
- [ ] 配一个后端能跑通「开始细化」
- [ ] GitHub topic `dsh-plugin` 已加
- [ ] 市场 Issue 已提交 / 条目已出现
- [ ] README 安装命令可直接复制
