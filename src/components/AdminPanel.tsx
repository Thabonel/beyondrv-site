import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PendingChange {
  path: string;
  content: string;
  description: string;
}

type DeployStatus = 'idle' | 'deploying' | 'done' | 'error';

export default function AdminPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm the Beyond RV admin assistant. Tell me what you'd like to change on the site." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingChange[]>([]);
  const [deployStatus, setDeployStatus] = useState<DeployStatus>('idle');
  const [deployResults, setDeployResults] = useState<string>('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setInput('');
    setLoading(true);

    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    try {
      const res = await fetch('/.netlify/functions/admin-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json() as { text: string; pendingChanges: PendingChange[] };

      setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);

      if (data.pendingChanges?.length) {
        setPending(prev => {
          const updated = [...prev];
          for (const change of data.pendingChanges) {
            const idx = updated.findIndex(p => p.path === change.path);
            if (idx >= 0) updated[idx] = change;
            else updated.push(change);
          }
          return updated;
        });
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      sendMessage(`[Image upload] filename: ${file.name}, base64: ${base64.slice(0, 20)}...`);
    };
    reader.readAsDataURL(file);
  }

  async function deploy() {
    if (!pending.length || deployStatus === 'deploying') return;
    setDeployStatus('deploying');
    try {
      const res = await fetch('/.netlify/functions/admin-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: pending }),
      });
      const data = await res.json() as { results: { path: string; ok: boolean; error?: string }[] };
      const failed = data.results.filter(r => !r.ok);
      if (failed.length) {
        setDeployStatus('error');
        setDeployResults(`${failed.length} file(s) failed to commit.`);
      } else {
        setDeployStatus('done');
        setDeployResults(`${pending.length} change(s) deployed. Site rebuilds in ~30s.`);
        setPending([]);
      }
    } catch {
      setDeployStatus('error');
      setDeployResults('Deploy failed. Check your connection and try again.');
    }
  }

  const deployLabel = {
    idle: `Deploy ${pending.length} Change${pending.length !== 1 ? 's' : ''}`,
    deploying: 'Deploying…',
    done: '✓ Live in ~30s',
    error: 'Deploy Failed',
  }[deployStatus];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', gap: '1rem', padding: '1rem', fontFamily: 'inherit' }}>
      {/* Chat panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#111', borderRadius: '8px', border: '1px solid #333' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #333', fontWeight: 600, color: '#fff' }}>
          Admin Chat
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              background: m.role === 'user' ? '#E8540A' : '#222',
              color: '#fff',
              padding: '0.6rem 0.9rem',
              borderRadius: '8px',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', color: '#888', fontSize: '0.85rem' }}>Thinking…</div>
          )}
          <div ref={bottomRef} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', borderTop: '1px solid #333' }}>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ background: '#222', border: '1px solid #444', color: '#aaa', borderRadius: '6px', padding: '0 0.75rem', cursor: 'pointer', fontSize: '1.1rem' }}
            title="Upload image"
          >📎</button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Type a change… (Enter to send)"
            style={{ flex: 1, background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.9rem', outline: 'none' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{ background: '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0 1rem', cursor: 'pointer', fontWeight: 600 }}
          >→</button>
        </div>
      </div>

      {/* Pending panel */}
      <div style={{ width: '300px', display: 'flex', flexDirection: 'column', background: '#111', borderRadius: '8px', border: '1px solid #333' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #333', fontWeight: 600, color: '#fff' }}>
          Pending Changes ({pending.length})
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {pending.length === 0 && (
            <p style={{ color: '#555', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>No changes yet</p>
          )}
          {pending.map((c, i) => (
            <div key={i} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', padding: '0.6rem 0.75rem', fontSize: '0.8rem' }}>
              <div style={{ color: '#E8540A', marginBottom: '0.25rem' }}>✏️ {c.path.split('/').pop()}</div>
              <div style={{ color: '#ccc', lineHeight: 1.4 }}>{c.description}</div>
              <button
                onClick={() => setPending(prev => prev.filter((_, j) => j !== i))}
                style={{ marginTop: '0.4rem', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
              >✕ remove</button>
            </div>
          ))}
        </div>
        <div style={{ padding: '0.75rem', borderTop: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {deployResults && (
            <p style={{ fontSize: '0.8rem', color: deployStatus === 'error' ? '#f87' : '#8f8', margin: 0 }}>{deployResults}</p>
          )}
          <button
            onClick={deploy}
            disabled={pending.length === 0 || deployStatus === 'deploying'}
            style={{
              background: pending.length === 0 ? '#333' : '#E8540A',
              color: pending.length === 0 ? '#666' : '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.7rem',
              fontWeight: 700,
              cursor: pending.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
            }}
          >{deployLabel}</button>
          {deployStatus === 'done' && (
            <button
              onClick={() => { setDeployStatus('idle'); setDeployResults(''); }}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem' }}
            >Make more changes</button>
          )}
        </div>
      </div>
    </div>
  );
}
