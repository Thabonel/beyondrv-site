import React from 'react';

// Mirrors MARKETING_IDEA_STATUSES in netlify/functions/owner-copilot-core.ts.
// The admin bundle does not import server modules, so the list is repeated here.
export const MARKETING_IDEA_STATUSES = ['idea', 'drafted', 'approved', 'rejected', 'published'];

const STATUS_COLOUR: Record<string, string> = {
  idea: '#888',
  drafted: '#fb923c',
  approved: '#4ade80',
  rejected: '#f87171',
  published: '#60a5fa',
};

// Matches the high/medium/low entries in AdminDashboard's STATUS_COLOUR so the
// same priority reads the same in both panels.
const PRIORITY_COLOUR: Record<string, string> = {
  high: '#f87171',
  medium: '#fb923c',
  low: '#4ade80',
};

export interface MarketingIdea {
  id: string;
  title: string;
  recommendation: string;
  evidence: string;
  priority: string;
  status: string;
  updatedAt: string;
}

function labelise(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export default function MarketingIdeas({
  ideas,
  loading,
  error,
  savingId,
  onStatusChange,
}: {
  ideas: MarketingIdea[];
  loading: boolean;
  error: string;
  savingId: string | null;
  onStatusChange: (idea: MarketingIdea, status: string) => void;
}) {
  if (loading && ideas.length === 0) {
    return <p style={{ margin: 0, color: '#888', fontSize: '0.78rem' }}>Loading saved ideas…</p>;
  }

  if (error) {
    return <p style={{ margin: 0, color: '#f87171', fontSize: '0.78rem' }}>{error}</p>;
  }

  if (ideas.length === 0) {
    return (
      <p style={{ margin: 0, color: '#777', fontSize: '0.78rem' }}>
        No saved ideas yet. Save an insight from Marketing Insights to start tracking it.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.55rem' }}>
      {ideas.map((idea) => (
        <div
          key={idea.id}
          data-testid={`marketing-idea-${idea.id}`}
          style={{ borderBottom: '1px solid #252525', paddingBottom: '0.55rem', display: 'grid', gap: '0.3rem' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 800 }}>{idea.title}</div>
            {idea.priority && (
              <span data-testid="marketing-idea-priority" style={{
                color: PRIORITY_COLOUR[idea.priority] ?? '#aaa',
                border: `1px solid ${PRIORITY_COLOUR[idea.priority] ?? '#444'}`,
                borderRadius: '999px',
                padding: '0.12rem 0.45rem',
                fontSize: '0.66rem',
                fontWeight: 800,
                whiteSpace: 'nowrap',
              }}>
                {labelise(idea.priority)}
              </span>
            )}
          </div>

          {idea.recommendation && (
            <div style={{ color: '#ddd', fontSize: '0.74rem', lineHeight: 1.4 }}>{idea.recommendation}</div>
          )}
          {idea.evidence && (
            <div style={{ color: '#888', fontSize: '0.68rem', lineHeight: 1.35 }}>{idea.evidence}</div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
            <label htmlFor={`idea-status-${idea.id}`} style={{ color: '#777', fontSize: '0.68rem' }}>
              Status
            </label>
            <select
              id={`idea-status-${idea.id}`}
              value={idea.status}
              disabled={savingId === idea.id}
              onChange={(event) => onStatusChange(idea, event.target.value)}
              style={{
                background: '#1a1a1a',
                border: `1px solid ${STATUS_COLOUR[idea.status] ?? '#444'}`,
                color: STATUS_COLOUR[idea.status] ?? '#ccc',
                borderRadius: '6px',
                padding: '0.2rem 0.35rem',
                fontSize: '0.68rem',
                fontWeight: 800,
                cursor: savingId === idea.id ? 'wait' : 'pointer',
              }}
            >
              {MARKETING_IDEA_STATUSES.map((status) => (
                <option key={status} value={status}>{labelise(status)}</option>
              ))}
            </select>
            {savingId === idea.id && <span style={{ color: '#777', fontSize: '0.68rem' }}>Saving…</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
