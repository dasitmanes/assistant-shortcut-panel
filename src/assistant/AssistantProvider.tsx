import { Button } from 'tdesign-react';
import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type PropsWithChildren,
} from 'react';
import { AssistantDialog } from './AssistantDialog';
import {
  AssistantUnavailableError, contextForRoute, type AssistantInvocationRequest,
  type AssistantPageObject, type AssistantProviderProps,
} from './contracts';
import { assistantPlatform, isAssistantShortcut, preservesLocalShortcut } from './keyboard';
import './assistant.css';

interface AssistantRuntime {
  toggle(): void;
  register(key: symbol, object: AssistantPageObject): () => void;
}

const AssistantContext = createContext<AssistantRuntime | null>(null);

const hints = {
  opening: '正在打开助手…',
  loading: '正在检查助手权限，请稍后重试。',
  paused: '助手已暂停',
  failed: '暂时无法打开助手，请重试。',
} as const;

export function AssistantProvider({ children, access, route, client, Chat, objectLabels }: PropsWithChildren<AssistantProviderProps>) {
  const declarations = useRef(new Map<symbol, AssistantPageObject>());
  const opener = useRef<HTMLElement | null>(null);
  const pending = useRef<AbortController | null>(null);
  const dismissed = useRef<AssistantInvocationRequest | null>(null);
  const isOpen = useRef(false);
  const [session, setSession] = useState<AssistantInvocationRequest | null>(null);
  const [hint, setHint] = useState<keyof typeof hints | null>(null);

  const register = useCallback((key: symbol, object: AssistantPageObject) => {
    declarations.current.set(key, object);
    return () => { declarations.current.delete(key); };
  }, []);

  const close = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
    isOpen.current = false;
    setSession(null);
    setHint(null);
  }, []);

  const toggle = useCallback(() => {
    if (pending.current || isOpen.current) {
      close();
      return;
    }

    const activeElement = document.activeElement;
    opener.current = activeElement instanceof HTMLElement ? activeElement : null;

    if (access !== 'allowed') {
      setHint(access === 'loading' ? 'loading' : 'paused');
      return;
    }

    const declared = Array.from(declarations.current.values()).at(-1);
    const page = contextForRoute(route, declared);
    const removed = dismissed.current;
    const context = removed?.route === page.route && removed.object_type === page.object_type && removed.object_id === page.object_id
      ? contextForRoute(route)
      : page;

    const request = new AbortController();
    pending.current = request;
    setHint('opening');

    async function openAfterPermissionCheck() {
      try {
        await client.invoke(context, request.signal);
        if (pending.current !== request) return;

        isOpen.current = true;
        setHint(null);
        setSession(context);
      } catch (error) {
        if (pending.current !== request) return;

        setHint(error instanceof AssistantUnavailableError ? 'paused' : 'failed');
      } finally {
        if (pending.current === request) pending.current = null;
      }
    }

    void openAfterPermissionCheck();
  }, [access, client, close, route]);

  useLayoutEffect(() => {
    // Navigation invalidates pending or open work tied to the previous page.
    dismissed.current = null;
    close();
    return () => { pending.current?.abort(); pending.current = null; };
  }, [close, route]);

  useEffect(() => {
    if (access !== 'allowed' && (pending.current || isOpen.current)) {
      close();
      setHint(access === 'loading' ? 'loading' : 'paused');
    }
  }, [access, close]);

  // A window bubble listener lets the focused editor handle or reserve its own key first.
  useEffect(() => {
    function onKeydown(event: globalThis.KeyboardEvent) {
      if (!isAssistantShortcut(event, assistantPlatform(navigator)) || preservesLocalShortcut(event)) return;
      if (!event.cancelable) return;

      event.preventDefault();
      if (!event.repeat) toggle();
    }

    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [toggle]);

  const runtime = useMemo(() => ({ register, toggle }), [register, toggle]);
  const label = session?.object_type ? objectLabels?.[session.object_type] ?? '当前记录' : undefined;

  function removeContext() {
    if (!session) return;

    dismissed.current = session;
    setSession(contextForRoute(session.route));
  }

  function dismissHint() {
    setHint(null);
    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
  }

  return (
    <AssistantContext.Provider value={runtime}>
      {children}
      <AssistantDialog open={session !== null} opener={opener.current} label={label} onRemoveContext={removeContext} onClose={close}>
        {session && <Chat context={session} />}
      </AssistantDialog>
      <div className="assistant-hint" data-visible={hint !== null}>
        <div role="status" aria-atomic="true">{hint && hints[hint]}</div>
        {hint && hint !== 'opening' && <Button type="button" size="small" variant="text" shape="square" aria-label="关闭提示" onClick={dismissHint}><span className="assistant-close-glyph" aria-hidden="true" /></Button>}
      </div>
    </AssistantContext.Provider>
  );
}

function useAssistantRuntime(): AssistantRuntime {
  const runtime = useContext(AssistantContext);
  if (!runtime) throw new Error('Assistant hooks must render inside AssistantProvider.');
  return runtime;
}

export function useAssistant() {
  const { toggle } = useAssistantRuntime();
  return { toggle };
}

export function useAssistantPageContext(object?: AssistantPageObject): void {
  const { register } = useAssistantRuntime();
  const key = useRef(Symbol('assistant-page'));
  const objectType = object?.objectType.trim();
  const objectId = object?.objectId.trim();

  useLayoutEffect(() => {
    if (!objectType || !objectId) return;
    return register(key.current, { objectType, objectId });
  }, [register, objectId, objectType]);
}
