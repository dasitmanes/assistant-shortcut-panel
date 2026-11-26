import { Button, Input } from 'tdesign-react';
import { useState, type FormEvent } from 'react';
import type { AssistantChatProps } from '../assistant';

export function MockAssistantChat({ context }: AssistantChatProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<string[]>([]);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;

    setMessages((previous) => [...previous, text]);
    setMessage('');
  }

  return (
    <section className="chat" aria-label="助手对话">
      <div role="log" aria-label="对话记录" className="chat__transcript">
        <p className="chat__reply">你好，有什么可以帮你整理的？</p>
        {messages.map((text, index) => (
          <div key={index}>
            <p className="chat__sent">{text}</p>
            <p className="chat__reply">
              {context.object_id ? '消息已在本地演示中接收，当前记录标识已附上。' : '消息已在本地演示中接收，未附上记录标识。'}
            </p>
          </div>
        ))}
      </div>
      <form className="chat__form" onSubmit={send}>
        <div className="chat__compose">
          <label data-assistant-input className="chat__field">
            <span>消息</span>
            <Input value={message} onChange={setMessage} placeholder="输入消息" />
          </label>
          <Button theme="primary" type="submit">发送</Button>
        </div>
      </form>
    </section>
  );
}
