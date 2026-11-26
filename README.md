# 工作台助手面板 · S5-ASST-012

React、TypeScript 与 TDesign 的可运行组件交付。示例包含线索详情、目录、编辑器和助手权限开关，所有记录均为合成数据。

## 运行与验收

需要 Node.js 22.12 或更高版本。

```sh
npm ci
npm run dev
```

打开终端显示的本地地址。在「线索详情」聚焦「记录名称」，用 macOS 的 `⌘K` 或 Windows / Linux 的 `Ctrl+K` 打开助手。按 `Esc`、再次按同一快捷键或选择关闭按钮，焦点回到原来的控件。也可直接选择「打开助手」。

- 在富文本、代码编辑器或「局部快捷键输入框」中使用快捷键，工作台保持编辑控件自己的键盘行为。
- 用 `Tab` 与 `Shift+Tab` 检查对话框内循环。移除「当前页面」标签后，光标回到消息输入框。
- 切换「系统暂停」或「角色无权限」，等待状态更新后再次使用快捷键，应看到可关闭的「助手已暂停」提示。
- 在窄屏视口打开同一页面，助手全屏展示。

```sh
npm run build
npx playwright install chromium
npm test
npm run evidence
```

已安装 Microsoft Edge 时，可将 `PLAYWRIGHT_BROWSER_CHANNEL` 设为 `msedge` 来运行同一套 Chromium 测试。保留该环境变量运行 `npm run evidence`，报告会标明浏览器通道。验证结果见 [验收记录](./evidence/acceptance.md) 和 [axe 原始检查摘要](./evidence/axe.json)。平台差异通过真实浏览器内注入的平台标识来验证，移动视口使用触屏模拟。

## 接入工作台

将 `src/assistant/` 接入工作台，沿用 TDesign 样式 `tdesign-react/es/style/index.css`。工作台外壳在路由层挂载一次 `AssistantProvider`，业务页通过 `useAssistantPageContext` 声明一个当前对象。目录等无对象页可以省略声明。将真实 AssistantChat 适配成接收 `context` 的组件，并在输入框或其容器上加 `data-assistant-input`。

```tsx
import 'tdesign-react/es/style/index.css';
import {
  AssistantProvider,
  createAssistantClient,
  useAssistantPageContext,
  type AssistantChatProps,
} from './assistant';

const client = createAssistantClient('/api/assistant/invoke');
const labels = { lead: '线索详情' };

function LeadPage({ id }: { id: string }) {
  useAssistantPageContext({ objectType: 'lead', objectId: id });
  return <main><h1>线索详情</h1></main>;
}

function ChatAdapter({ context }: AssistantChatProps) {
  return <div data-assistant-input><AssistantChat declaredContext={context} /></div>;
}

// Inside the authenticated shell. iamAccess is an authoritative status from S2-IAM.
<AssistantProvider
  route="/workbench/leads/detail"
  access={iamAccess}
  client={client}
  Chat={ChatAdapter}
  objectLabels={labels}
>
  <LeadPage id={selectedLeadId} />
</AssistantProvider>;
```

`AssistantChat`、`iamAccess` 和 `selectedLeadId` 表示宿主现有接口与状态。可用 `useAssistant().toggle` 为触屏或无匹配快捷键的浏览器接入可见按钮。快捷键依次按 `navigator.userAgentData.platform`、`navigator.platform` 和传统 UA 判断，在编辑器祖先容器声明 `data-hotkey-scope="local"` 即可保留本地快捷键。

## 请求与权限约定

调用只向同源 `POST /api/assistant/invoke` 发送一个精确的 JSON 对象，例如：

```json
{
  "route": "/workbench/leads/detail",
  "object_type": "lead",
  "object_id": "d4005961-b169-4b74-8905-186300000012"
}
```

无对象时仍保留三个字段，两个对象字段为 `null`。宿主应传入稳定的路由模式，避免在路径内放入敏感内容，接口剥离查询字符串与片段。请求只读取路由和声明的两个标识，页面表单、富文本、其余记录属性与模拟聊天内容留在浏览器。关闭上下文标签会清空 Chat 适配器的对象字段，再次打开同一页面和对象时也以空对象发起调用。移除操作只作用于后续调用，已经到达服务器的调用不被撤回。

- **S2-WB** 提供稳定路由、当前记录 ID、工作台壳层和真实 `AssistantChat`。
- **S2-IAM** 提供 `loading`、`allowed`、`paused` 或 `forbidden` 状态。同源生产后端应从受信任的认证会话读取角色、暂停状态与对象访问权限，每次调用均重新校验。成功状态为 2xx，401、403 或 423 保持面板关闭并显示暂停提示。其他故障提示重试。
- **本地模拟** 在 `vite.config.ts` 中实现。界面选择演示情景，模拟政策接口设置一枚本地 Cookie，调用接口再根据该 Cookie 拒绝或接受并核对字段。它只用于合成场景验证。生产部署替换此中间件，且移除情景开关与演示 Cookie。

`npm run preview` 可在构建后托管本地演示与模拟接口。集成时只复用 `src/assistant/` 及宿主自己的权限与聊天适配器。
