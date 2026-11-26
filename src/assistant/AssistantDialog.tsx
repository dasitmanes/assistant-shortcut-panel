import { Button, Tag } from 'tdesign-react';
import { useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

interface AssistantDialogProps {
  open: boolean;
  opener: HTMLElement | null;
  label?: string;
  onRemoveContext(): void;
  onClose(): void;
  children: ReactNode;
}

const tabbable = 'button, a[href], input, textarea, select, [tabindex], [contenteditable="true"]';
const preferredInput = '[data-assistant-input]:is(input, textarea), [data-assistant-input] :is(input, textarea)';

function focusableItems(dialog: HTMLDialogElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(tabbable)).filter((element) => (
    element.tabIndex >= 0 &&
    !element.matches(':disabled, [aria-disabled="true"]') &&
    !element.closest('[inert], [hidden]') &&
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility === 'visible'
  ));
}

export function AssistantDialog({ open, opener, label, onRemoveContext, onClose, children }: AssistantDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      const input = dialog.querySelector<HTMLElement>(preferredInput);
      (input ?? titleRef.current)?.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    }
  }, [open, opener]);

  function keepTabInside(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab' || event.defaultPrevented) return;
    const items = focusableItems(event.currentTarget);
    const first = items.at(0);
    const last = items.at(-1);
    const active = document.activeElement;

    if (!first || !last) {
      event.preventDefault();
      titleRef.current?.focus();
      return;
    }

    const atBoundary = event.shiftKey ? active === first : active === last;
    if (atBoundary || !items.includes(active as HTMLElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  function removeContext() {
    // Its button unmounts immediately, so transfer focus to a stable control first.
    (dialogRef.current?.querySelector<HTMLElement>(preferredInput) ?? titleRef.current)?.focus();
    onRemoveContext();
  }

  return (
    <dialog
      ref={dialogRef}
      className="assistant-dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      onKeyDown={keepTabInside}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {open && <>
        <header className="assistant-dialog__header">
          <h2 id={titleId} ref={titleRef} tabIndex={-1}>工作台助手</h2>
          <Button type="button" variant="outline" shape="square" aria-label="关闭助手" onClick={onClose}>
            <span className="assistant-close-glyph" aria-hidden="true" />
          </Button>
        </header>
        {label && (
          <div className="assistant-dialog__context">
            <Tag theme="primary" variant="light">当前页面：{label}</Tag>
            <Button type="button" size="small" variant="text" shape="square" aria-label="移除页面上下文" onClick={removeContext}>
              <span className="assistant-close-glyph" aria-hidden="true" />
            </Button>
          </div>
        )}
        <div className="assistant-dialog__body">{children}</div>
      </>}
    </dialog>
  );
}
