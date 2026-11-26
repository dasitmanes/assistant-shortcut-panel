# 验收记录

运行时间（UTC） 2026-11-26T01:59:47.422Z

真实浏览器 Playwright 环境通过 23 项。Node v24.16.0，浏览器通道 msedge。

| 检查 | 结果 |
| --- | --- |
| macOS client hint takes priority and captures only Command+K | Pass |
| Windows legacy platform captures Control+K and preserves Command+K | Pass |
| Linux user agent fallback captures Control+K when platform metadata is absent | Pass |
| legacy macOS platform uses Command+K without a client hint | Pass |
| combined modifiers, alternate keys, IME composition and noncancelable events are preserved | Pass |
| holding the accelerator captures repeats without closing or invoking again | Pass |
| editor opt-out preserves the browser event at 局部快捷键输入框 | Pass |
| editor opt-out preserves the browser event at 富文本编辑器 | Pass |
| editor opt-out preserves the browser event at 代码编辑器 | Pass |
| a control that already handles the accelerator retains it | Pass |
| Escape closes and restores exact focus to the shortcut opener | Pass |
| repeated accelerator closes and restores focus without sending another request | Pass |
| named close button restores focus to the pointer launcher | Pass |
| modal has an accessible title and loops keyboard focus in both directions | Pass |
| intercepted POST contains precisely the three identifiers and excludes page data | Pass |
| removing context keeps focus in chat and next invocation sends null object fields | Pass |
| navigation unregisters the previous object and declares the next page | Pass |
| 系统暂停 keeps the modal closed and announces a dismissible hint without an invocation | Pass |
| 角色无权限 keeps the modal closed and announces a dismissible hint without an invocation | Pass |
| a backend authorization failure overrides stale allowed UI policy | Pass |
| backend mock rejects any extra payload field and rechecks permissions independently | Pass |
| desktop modal is centered at 720px by 70vh and axe finds no violations | Pass |
| mobile modal fills the viewport, remains interactive and passes axe | Pass |

展开后的面板分别在桌面和移动视口中运行 axe。详细规则、检查引擎和需人工复核的项目见 [axe.json](./axe.json)。
