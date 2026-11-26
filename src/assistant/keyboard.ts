type AssistantPlatform = 'mac' | 'control' | 'other';

export type PlatformNavigator = Pick<Navigator, 'platform' | 'userAgent'> & {
  userAgentData?: { platform?: string };
};

const editorSelectors = [
  '[data-hotkey-scope="local"]',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"][aria-multiline="true"]',
  '.monaco-editor',
  '.cm-editor',
  '.CodeMirror',
  '.ace_editor',
  '.ProseMirror',
  '.ql-editor',
].join(', ');

function classify(value: string): AssistantPlatform | undefined {
  if (/android|iphone|ipad|ipod|\bios\b/i.test(value)) return 'other';
  if (/mac/i.test(value)) return 'mac';
  if (/windows|^win|linux|cros/i.test(value)) return 'control';
  return undefined;
}

export function assistantPlatform(source: PlatformNavigator): AssistantPlatform {
  const clientHints = classify(source.userAgentData?.platform ?? '');
  if (clientHints) return clientHints;

  // Android and iPad can identify as Linux or Mac in the legacy platform field.
  if (classify(source.userAgent) === 'other') return 'other';

  return classify(source.platform) ?? classify(source.userAgent) ?? 'other';
}

export function preservesLocalShortcut(event: KeyboardEvent): boolean {
  return event.composedPath().some((node) => node instanceof Element && node.closest(editorSelectors) !== null);
}

export function isAssistantShortcut(event: KeyboardEvent, platform: AssistantPlatform): boolean {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey) return false;
  if (event.key.toLowerCase() !== 'k') return false;

  if (platform === 'mac') return event.metaKey && !event.ctrlKey;
  if (platform === 'control') return event.ctrlKey && !event.metaKey;
  return false;
}

export function assistantShortcutLabel(source: PlatformNavigator): string | undefined {
  const platform = assistantPlatform(source);
  if (platform === 'mac') return '⌘ K';
  if (platform === 'control') return 'Ctrl K';
  return undefined;
}
