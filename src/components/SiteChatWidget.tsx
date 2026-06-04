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

const SESSION_CAP = 30;
const TIMEOUT_MS = 45000;
const FALLBACK_ERROR = "Something went wrong — try again or hit 'Talk to a human'.";
const EMAIL_PATTERN = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

function renderMessageContent(content: string) {
  const parts = content.split(EMAIL_PATTERN);
  return parts.map((part, index) => {
    if (!part.match(EMAIL_PATTERN)) return part;
    return (
      <a key={`${part}-${index}`} href={`mailto:${part}`}>
        {part}
      </a>
    );
  });
}

export default function SiteChatWidget({ pageTitle, productSlug, productName }: Props) {
  const initialGreeting = productName
    ? `Got questions about the ${productName}? Ask away.`
    : "Hi! I'm the Beyond RV assistant. Ask me anything about our campers and caravans.";

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: initialGreeting },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isInquiryPage, setIsInquiryPage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isCapped = messages.length >= SESSION_CAP;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setIsInquiryPage(window.location.pathname.startsWith('/inquiry-form'));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const panel = panelRef.current;
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile) return;
    function adjustForKeyboard() {
      const keyboardOffset = window.innerHeight - visualViewport!.height;
      panel.style.height = `${visualViewport!.height}px`;
      panel.style.transform = keyboardOffset > 80 ? `translateY(${visualViewport!.offsetTop}px)` : '';
    }
    visualViewport.addEventListener('resize', adjustForKeyboard);
    visualViewport.addEventListener('scroll', adjustForKeyboard);
    adjustForKeyboard();
    return () => {
      visualViewport.removeEventListener('resize', adjustForKeyboard);
      visualViewport.removeEventListener('scroll', adjustForKeyboard);
      panel.style.height = '';
      panel.style.transform = '';
    };
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
    if (!text || loading || isCapped) return;

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

    const timeoutId = setTimeout(() => {
      controller.abort();
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: "Sorry, I hit a snag. Try again or hit 'Talk to a human' to reach the team directly." },
      ]);
      setLoading(false);
    }, TIMEOUT_MS);

    try {
      const response = await fetch('/.netlify/functions/site-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, productSlug, pageTitle }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

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

        const lines = accumulated.split('\n');
        accumulated = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);

          if (payload === '[DONE]') {
            clearTimeout(timeoutId);
            reader.cancel();
            setMessages(prev => [
              ...prev,
              { role: 'assistant', content: finalText || FALLBACK_ERROR },
            ]);
            setLoading(false);
            return;
          }

          if (payload === '[ERROR]') {
            clearTimeout(timeoutId);
            reader.cancel();
            setMessages(prev => [
              ...prev,
              { role: 'assistant', content: FALLBACK_ERROR },
            ]);
            setLoading(false);
            return;
          }

          finalText += payload.replace(/\\n/g, '\n');
        }
      }

      clearTimeout(timeoutId);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: finalText || FALLBACK_ERROR },
      ]);
      setLoading(false);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: FALLBACK_ERROR },
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

    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    const summary = lastAssistant?.content ? `Chat summary: ${lastAssistant.content}` : '';
    const params = new URLSearchParams();
    if (summary) params.set('message', summary);
    if (productSlug) params.set('product', productSlug);
    if (productName) params.set('name', productName);
    window.open(`/inquiry-form/?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className={`chat-widget${isOpen ? ' chat-widget-open' : ''}${isInquiryPage ? ' chat-widget-inquiry' : ''}`}>
      <button
        className="chat-widget-btn"
        onClick={togglePanel}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        aria-expanded={isOpen}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            fill="currentColor"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="chat-panel"
          role="dialog"
          aria-label="Beyond RV chat assistant"
          aria-modal="true"
        >
          <div className="chat-panel-header">
            <span>Beyond RV Assistant</span>
            <button className="chat-human-btn" onClick={handleHandoff}>
              Talk to a human →
            </button>
            <button className="chat-close-btn" onClick={() => setIsOpen(false)}>
              ✕
            </button>
          </div>

          <div className="chat-messages" role="log" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble chat-bubble-${m.role}`}>
                {renderMessageContent(m.content)}
              </div>
            ))}
            {loading && (
              <div className="chat-bubble chat-bubble-assistant chat-loading">…</div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-bar">
            <input
              ref={inputRef}
              className="chat-input"
              aria-label="Your message"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={isCapped ? 'Session limit reached' : 'Ask anything…'}
              disabled={loading || isCapped}
            />
            <button onClick={sendMessage} disabled={loading || isCapped || !input.trim()}>
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
