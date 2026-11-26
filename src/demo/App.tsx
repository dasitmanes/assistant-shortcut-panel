import { Button } from 'tdesign-react';
import { useEffect, useState } from 'react';
import {
  AssistantProvider, assistantShortcutLabel, createAssistantClient, useAssistant, useAssistantPageContext,
  type AssistantAccess,
} from '../assistant';
import { MockAssistantChat } from './MockAssistantChat';

type DemoAccess = Exclude<AssistantAccess, 'loading'>;
type DemoPage = 'lead' | 'directory';

const client = createAssistantClient();
const lead = { objectType: 'lead', objectId: 'd4005961-b169-4b74-8905-186300000012' };
const labels = { lead: '线索详情' };
const routes: Record<DemoPage, string> = { lead: '/workbench/leads/detail', directory: '/workbench/directory' };
const modes: ReadonlyArray<{ mode: DemoAccess; label: string }> = [
  { mode: 'allowed', label: '可用' },
  { mode: 'paused', label: '系统暂停' },
  { mode: 'forbidden', label: '角色无权限' },
];

function AssistantLauncher() {
  const { toggle } = useAssistant();
  const shortcut = assistantShortcutLabel(navigator);

  return (
    <Button type="button" theme="primary" size="medium" onClick={toggle} aria-label="打开助手">
      打开助手{shortcut && <kbd className="workbench__shortcut" aria-hidden="true">{shortcut}</kbd>}
    </Button>
  );
}

interface WorkbenchProps {
  page: DemoPage;
  mode: DemoAccess;
  access: AssistantAccess;
  changePage(page: DemoPage): void;
  changeMode(mode: DemoAccess): void;
}

function Workbench({ page, mode, access, changePage, changeMode }: WorkbenchProps) {
  useAssistantPageContext(page === 'lead' ? lead : undefined);

  return (
    <div className="workbench">
      <header className="workbench__bar">
        <div className="workbench__brand"><span aria-hidden="true">工</span> 工作台</div>
        <AssistantLauncher />
      </header>
      <div className="workbench__frame">
        <aside className="workbench__rail">
          <nav aria-label="工作台页面">
            <button type="button" aria-current={page === 'lead' ? 'page' : undefined} onClick={() => changePage('lead')}>线索详情</button>
            <button type="button" aria-current={page === 'directory' ? 'page' : undefined} onClick={() => changePage('directory')}>目录</button>
          </nav>
        </aside>
        <main className="workbench__main">
          <div className="workbench__title">
            <h1>{page === 'lead' ? '线索详情' : '目录'}</h1>
            <p>{page === 'lead' ? '练习记录 · 仅用于本地演示' : '未选择记录 · 仅用于本地演示'}</p>
          </div>
          <div className="workbench__cards">
            <section className="workbench__card" aria-labelledby="demo-editors">
              <h2 id="demo-editors">记录与编辑</h2>
              <label htmlFor="lead-name">记录名称</label>
              <input id="lead-name" defaultValue="合成线索 A" />
              <div data-hotkey-scope="local">
                <label htmlFor="local-input">局部快捷键输入框</label>
                <input id="local-input" placeholder="此区域保留自身快捷键" />
              </div>
              <div className="workbench__editors">
                <div>
                  <p id="rich-editor-label">富文本编辑器</p>
                  <div contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-labelledby="rich-editor-label" className="workbench__editor">虚构备注</div>
                </div>
                <div className="cm-editor">
                  <label htmlFor="code-editor">代码编辑器</label>
                  <textarea id="code-editor" className="workbench__editor" defaultValue="const sample = 1;" />
                </div>
              </div>
            </section>
            <section className="workbench__card" aria-labelledby="demo-access">
              <h2 id="demo-access">助手权限演示</h2>
              <p>当前状态 <strong data-testid="access-state">{modes.find(({ mode }) => mode === access)?.label ?? '正在检查'}</strong></p>
              <div className="workbench__modes" role="group" aria-label="设置演示权限">
                {modes.map((option) => (
                  <Button key={option.mode} type="button" variant={option.mode === mode ? 'base' : 'outline'} theme="primary" aria-pressed={option.mode === mode} onClick={() => changeMode(option.mode)}>{option.label}</Button>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export function App() {
  const [page, setPage] = useState<DemoPage>('lead');
  const [mode, setMode] = useState<DemoAccess>('allowed');
  const [access, setAccess] = useState<AssistantAccess>('loading');

  useEffect(() => {
    const request = new AbortController();
    async function loadAccess() {
      try {
        const response = await fetch(`/api/assistant/policy?scenario=${mode}`, { signal: request.signal });
        if (!response.ok) throw new Error('Mock access endpoint unavailable.');
        const { access: next } = await response.json();
        if (!request.signal.aborted) setAccess(modes.some(({ mode }) => mode === next) ? next : 'forbidden');
      } catch {
        if (!request.signal.aborted) setAccess('forbidden');
      }
    }

    void loadAccess();
    return () => request.abort();
  }, [mode]);

  function changeMode(next: DemoAccess) {
    if (next === mode) return;
    setAccess('loading');
    setMode(next);
  }

  return (
    <AssistantProvider access={access} route={routes[page]} client={client} Chat={MockAssistantChat} objectLabels={labels}>
      <Workbench page={page} mode={mode} access={access} changePage={setPage} changeMode={changeMode} />
    </AssistantProvider>
  );
}
