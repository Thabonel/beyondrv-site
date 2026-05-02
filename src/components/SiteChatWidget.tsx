import { useState, useEffect, useRef } from 'react';

interface Props {
  pageTitle?: string;
  productSlug?: string;
  productName?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function SiteChatWidget({ pageTitle, productSlug, productName }: Props) {
  const initialGreeting = productName
    ? `Got questions about the ${productName}? Ask away.`
    : "Hi! I'm the ByondRV assistant. Ask me anything about our campers and caravans.";

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: initialGreeting },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Escape key closes panel
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  function openPanel() {
    setIsOpen(true);
    (window as any).posthog?.capture('chat_opened', {
      page: pageTitle,
      product_slug: productSlug,
    });
  }

  function togglePanel() {
    if (isOpen) {
      setIsOpen(false);
    } else {
      openPanel();
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);

    const userMsg: Message = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    (window as any).posthog?.capture('chat_message_sent', {
      page: pageTitle,
      message_count: updatedMessages.length,
    });

    const controller = new AbortController();

    // 15-second timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content:
            "Sorry, I hit a snag. Try again or hit 'Talk to a human' to reach the team directly.",
        },
      ]);
      setLoading(false);
    }, 15000);
    try {
      const response = await fetch('/.netlify/functions/site-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          productSlug,
          pageTitle,
        }),
        signal: controller.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let accumulated = '';
      let finalText = '';
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          accumulated += decoder.decode(value, { stream: !done });
        }

        // Process all complete SSE lines in the accumulated buffer
        const lines = accumulated.split('\n');
        // Keep the last (possibly incomplete) line for the next iteration
        accumulated = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6); // strip "data: "

          if (payload === '[DONE]') {
            clearTimeout(timeoutId);
            setMessages(prev => [
              ...prev,
              { role: 'assistant', content: finalText },
            ]);
            setLoading(false);
            return;
          }

          if (payload === '[ERROR]') {
            clearTimeout(timeoutId);
            setMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content:
                  "Something went wrong — try again or hit 'Talk to a human'.",
              },
            ]);
            setLoading(false);
            return;
          }

          // Decode escaped newlines
          finalText += payload.replace(/\\n/g, '\n');
        }
      }

      // If stream ended without [DONE], still surface whatever we have
      clearTimeout(timeoutId);
      if (finalText) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: finalText },
        ]);
      }
      setLoading(false);
    } catch (err: unknown) {
      // AbortError means the timeout fired and already handled state
      if (err instanceof Error && err.name === 'AbortError') return;
      clearTimeout(timeoutId);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content:
            "Something went wrong — try again or hit 'Talk to a human'.",
        },
      ]);
      setLoading(false);
    }
  }

  function handleHandoff() {
    (window as any).posthog?.capture('chat_handoff', {
      page: pageTitle,
      product_slug: productSlug,
      message_count: messages.length,
    });

    const lastAssistant = [...messages]
      .reverse()
      .find(m => m.role === 'assistant');
    const encoded = encodeURIComponent(lastAssistant?.content ?? '');
    window.open(`/inquiry-form/?message=${encoded}`, '_blank');
  }

  return (
    <div className="chat-widget">
      {/* Toggle button — always visible */}
      <button
        className="chat-widget-btn"
        onClick={togglePanel}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        aria-expanded={isOpen}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            fill="currentColor"
          />
        </svg>
      </button>

      {/* Panel — conditionally rendered when isOpen */}
      {isOpen && (
        <div
          className="chat-panel"
          role="dialog"
          aria-label="ByondRV chat assistant"
        >
          {/* Header */}
          <div className="chat-panel-header">
            <span>ByondRV Assistant</span>
            <button className="chat-human-btn" onClick={handleHandoff}>
              Talk to a human →
            </button>
            <button
              className="chat-close-btn"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="chat-messages" role="log" aria-live="polite">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`chat-bubble chat-bubble-${m.role}`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="chat-bubble chat-bubble-assistant chat-loading">
                …
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="chat-input-bar">
            <input
              aria-label="Your message"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e =>
                e.key === 'Enter' && !e.shiftKey && sendMessage()
              }
              placeholder="Ask anything…"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
