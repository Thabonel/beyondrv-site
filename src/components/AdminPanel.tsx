import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type JudgeDecision = 'allow' | 'block' | 'revise' | 'escalate';

interface PendingChange {
  path: string;
  content: string;
  description: string;
  proposal_id: string;
  judgeDecision: JudgeDecision;
  risk_flags: string[];
  escalation_reason?: string;
}

type DeployStatus = 'idle' | 'deploying' | 'done' | 'error';

const VERDICT_STYLE: Record<JudgeDecision, { label: string; color: string; border: string }> = {
  allow:    { label: '✓ Approved',  color: '#4ade80', border: '1px solid #1a3a1a' },
  escalate: { label: '⚠ Escalated', color: '#fb923c', border: '1px solid #3a2010' },
  block:    { label: '✕ Blocked',   color: '#f87171', border: '1px solid #3a1010' },
  revise:   { label: '↩ Revised',   color: '#a78bfa', border: '1px solid #2a1a3a' },
};

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

    const escalated = pending.filter(c => c.judgeDecision === 'escalate');
    if (escalated.length) {
      const ok = window.confirm(
        `${escalated.length} change(s) were flagged for escalation by the safety judge:\n\n` +
        escalated.map(c => `• ${c.description}\n  Reason: ${c.escalation_reason ?? 'See risk flags'}`).join('\n\n') +
        '\n\nDeploy anyway?'
      );
      if (!ok) return;
    }

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

  const hasEscalated = pending.some(c => c.judgeDecision === 'escalate');

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
      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', background: '#111', borderRadius: '8px', border: '1px solid #333' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, color: '#fff' }}>Pending Changes ({pending.length})</span>
          {hasEscalated && (
            <span style={{ fontSize: '0.7rem', background: '#3a2010', color: '#fb923c', padding: '2px 6px', borderRadius: '4px' }}>
              ⚠ Needs review
            </span>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {pending.length === 0 && (
            <p style={{ color: '#555', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>No changes yet</p>
          )}
          {pending.map((c, i) => {
            const vs = VERDICT_STYLE[c.judgeDecision] ?? VERDICT_STYLE.allow;
            return (
              <div key={i} style={{ background: '#1a1a1a', border: vs.border, borderRadius: '6px', padding: '0.6rem 0.75rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ color: '#E8540A' }}>✏️ {c.path.split('/').pop()}</span>
                  <span style={{ color: vs.color, fontSize: '0.7rem', fontWeight: 600 }}>{vs.label}</span>
                </div>
                <div style={{ color: '#ccc', lineHeight: 1.4 }}>{c.description}</div>
                {c.judgeDecision === 'escalate' && c.escalation_reason && (
                  <div style={{ color: '#fb923c', fontSize: '0.72rem', marginTop: '0.3rem', lineHeight: 1.3 }}>
                    ⚠ {c.escalation_reason}
                  </div>
                )}
                {c.risk_flags?.length > 0 && c.judgeDecision !== 'allow' && (
                  <div style={{ color: '#666', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                    Flags: {c.risk_flags.join(', ')}
                  </div>
                )}
                <button
                  onClick={() => setPending(prev => prev.filter((_, j) => j !== i))}
                  style={{ marginTop: '0.4rem', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                >✕ remove</button>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '0.75rem', borderTop: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {deployResults && (
            <p style={{ fontSize: '0.8rem', color: deployStatus === 'error' ? '#f87' : '#8f8', margin: 0 }}>{deployResults}</p>
          )}
          <button
            onClick={deploy}
            disabled={pending.length === 0 || deployStatus === 'deploying'}
            style={{
              background: pending.length === 0 ? '#333' : hasEscalated ? '#7c3a10' : '#E8540A',
              color: pending.length === 0 ? '#666' : '#fff',
              border: hasEscalated ? '1px solid #fb923c' : 'none',
              borderRadius: '6px',
              padding: '0.7rem',
              fontWeight: 700,
              cursor: pending.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
            }}
          >{hasEscalated ? `⚠ ${deployLabel}` : deployLabel}</button>
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
