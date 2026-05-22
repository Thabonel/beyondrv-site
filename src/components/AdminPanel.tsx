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
  const [knowledgeInput, setKnowledgeInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);
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

  function queueKnowledgeUpdate() {
    const text = knowledgeInput.trim();
    if (!text) return;
    setKnowledgeInput('');
    sendMessage(
      `Update the chatbot business knowledge file at src/data/chatbot-knowledge.md with this information. ` +
      `Read the current file first, preserve useful existing notes, and add or update the relevant note clearly without adding private customer data:\n\n${text}`
    );
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
    <>
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', gap: '1rem', padding: '1rem', fontFamily: 'inherit' }}>
      {/* Chat panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#111', borderRadius: '8px', border: '1px solid #333' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #333', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <span>Admin Chat</span>
          <button
            onClick={() => setShowHelp(true)}
            style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.4rem 0.65rem', cursor: 'pointer', fontWeight: 600 }}
          >
            Help
          </button>
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
      <div style={{ width: '360px', display: 'flex', flexDirection: 'column', background: '#111', borderRadius: '8px', border: '1px solid #333' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #333' }}>
          <div style={{ color: '#fff', fontWeight: 600, marginBottom: '0.45rem' }}>Chatbot Knowledge</div>
          <p style={{ color: '#888', fontSize: '0.78rem', lineHeight: 1.4, margin: '0 0 0.6rem' }}>
            Add facts the website chatbot should know about the business, stock, process, or policies.
          </p>
          <textarea
            value={knowledgeInput}
            onChange={e => setKnowledgeInput(e.target.value)}
            placeholder="Example: Customers can inspect campers by appointment at Mutdapilly. Ask them to call first."
            rows={4}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.55rem 0.65rem', fontSize: '0.82rem', lineHeight: 1.45, outline: 'none' }}
          />
          <button
            onClick={queueKnowledgeUpdate}
            disabled={loading || !knowledgeInput.trim()}
            style={{ width: '100%', marginTop: '0.5rem', background: knowledgeInput.trim() ? '#E8540A' : '#333', color: knowledgeInput.trim() ? '#fff' : '#666', border: 'none', borderRadius: '6px', padding: '0.55rem', cursor: knowledgeInput.trim() ? 'pointer' : 'not-allowed', fontWeight: 700 }}
          >
            Queue Knowledge Update
          </button>
        </div>
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
    {showHelp && (
      <div
        role="dialog"
        aria-modal="true"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      >
        <div style={{ width: 'min(860px, 100%)', maxHeight: '88vh', overflowY: 'auto', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '8px', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>
          <div style={{ position: 'sticky', top: 0, background: '#111', borderBottom: '1px solid #333', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Admin Help</h2>
            <button
              onClick={() => setShowHelp(false)}
              style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.4rem 0.65rem', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
          <div style={{ padding: '1rem 1.1rem 1.2rem', display: 'grid', gap: '1rem', fontSize: '0.9rem', lineHeight: 1.55 }}>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>How the admin works</h3>
              <p style={{ margin: 0, color: '#ddd' }}>
                The admin chat prepares site changes for review. It does not make a change live immediately. Ask for one clear task, review the queued file changes in Pending Changes, then click Deploy when the change looks right.
              </p>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Update a product</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Type the product name and exactly what needs changing, such as price, wording, key specs, featured status, or availability.</li>
                <li>Wait for the assistant to read the current product file and queue the proposed change.</li>
                <li>Check the Pending Changes description and remove anything that looks wrong.</li>
                <li>Click Deploy. The live site usually updates after the Netlify rebuild completes.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Add a product</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Provide the product title, price, category, status, main specs, description, and selling points.</li>
                <li>Ask the assistant to create a new product file using the existing product format.</li>
                <li>For images, provide the intended filenames and order. Full image uploading still needs a developer or a later media manager.</li>
                <li>Deploy only after the new product path, price, specs, and image order have been checked.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Remove or sell a product</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Say which product has sold and whether it should be removed from listings or kept as coming soon.</li>
                <li>The assistant should remove it from active product content and make sure old links redirect to a relevant category page.</li>
                <li>Review the pending product and redirect changes before deploying.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Teach the chatbot</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Use the Chatbot Knowledge box for facts that apply across the business, not just one product.</li>
                <li>Add short, factual notes about process, appointments, stock, delivery, policy, warranty, or common customer questions.</li>
                <li>Do not add passwords, API keys, private customer details, or anything the public should not see.</li>
                <li>Click Queue Knowledge Update, review the pending change, then Deploy.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Best practice</h3>
              <p style={{ margin: 0, color: '#ddd' }}>
                Make one or two changes at a time. Use exact product names, exact prices, and exact wording where possible. If the assistant says a change needs review, treat it as a warning and check the file description carefully before deploying.
              </p>
            </section>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
