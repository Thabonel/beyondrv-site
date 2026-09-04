import React from 'react';

export interface ReviewCandidate {
  id: string;
  make: string;
  model: string;
  modelYear: number;
  grade: string;
  cabType: string;
  bodyType: string;
  gvmKg: number;
  kerbKg: number;
  trayLengthMm: number | null;
  trayWidthMm: number | null;
  verificationStatus: string;
  source: { manufacturer: string; title: string; url: string };
  included: boolean;
  corrections: Record<string, number>;
}

const CORRECTABLE = ['gvmKg', 'kerbKg', 'trayLengthMm', 'trayWidthMm'] as const;
const HEADINGS = ['', 'Vehicle', 'GVM (kg)', 'Kerb (kg)', 'Tray L (mm)', 'Tray W (mm)', 'Source'];

const cell: React.CSSProperties = {
  padding: '0.4rem 0.5rem',
  borderBottom: '1px solid #252525',
  fontSize: '0.74rem',
  color: '#ddd',
  verticalAlign: 'top',
};

const numberInput: React.CSSProperties = {
  width: '5.5rem',
  background: '#1a1a1a',
  border: '1px solid #333',
  color: '#fff',
  borderRadius: '4px',
  padding: '0.2rem 0.35rem',
  fontSize: '0.74rem',
};

export default function VehicleReview({
  candidates,
  makes,
  make,
  loading,
  error,
  publishing,
  onMakeChange,
  onToggle,
  onCorrect,
  onPublish,
}: {
  candidates: ReviewCandidate[];
  makes: string[];
  make: string;
  loading: boolean;
  error: string;
  publishing: boolean;
  onMakeChange: (make: string) => void;
  onToggle: (id: string, included: boolean) => void;
  onCorrect: (id: string, field: string, value: number | null) => void;
  onPublish: () => void;
}) {
  if (loading) return <p style={{ margin: 0, color: '#888', fontSize: '0.78rem' }}>Loading vehicles…</p>;
  if (error) {
    return (
      <p data-testid="vehicle-review-error" style={{ margin: 0, color: '#f87171', fontSize: '0.78rem', lineHeight: 1.45 }}>
        {error}
      </p>
    );
  }

  const tickedCount = candidates.filter((candidate) => candidate.included).length;

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <select
        data-testid="vehicle-review-make"
        aria-label="Make to review"
        value={make}
        onChange={(event) => onMakeChange(event.target.value)}
        style={{ ...numberInput, width: 'auto' }}
      >
        {makes.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>

      {candidates.length === 0 ? (
        <p data-testid="vehicle-review-empty" style={{ margin: 0, color: '#888', fontSize: '0.74rem' }}>
          Every {make} vehicle has been reviewed.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {HEADINGS.map((heading, index) => (
                  <th key={heading || `blank-${index}`} style={{ ...cell, color: '#888', fontWeight: 700, textAlign: 'left' }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.id} data-testid="vehicle-review-row">
                  <td style={cell}>
                    <input
                      type="checkbox"
                      data-testid={`vehicle-review-tick-${candidate.id}`}
                      aria-label={`Publish ${candidate.make} ${candidate.model} ${candidate.grade}`}
                      checked={candidate.included}
                      onChange={(event) => onToggle(candidate.id, event.target.checked)}
                    />
                  </td>
                  <td style={{ ...cell, color: '#fff' }}>
                    {candidate.make} {candidate.model} {candidate.modelYear} {candidate.grade}
                    {candidate.verificationStatus !== 'source_verified' && (
                      <div data-testid="vehicle-review-needs-check" style={{ color: '#e0b341', fontSize: '0.66rem' }}>
                        Needs a second look
                      </div>
                    )}
                  </td>
                  {CORRECTABLE.map((field) => (
                    <td key={field} style={cell}>
                      <input
                        type="number"
                        data-testid={`vehicle-review-${field}-${candidate.id}`}
                        aria-label={`${field} for ${candidate.model} ${candidate.grade}`}
                        style={numberInput}
                        value={candidate.corrections[field] ?? candidate[field] ?? ''}
                        onChange={(event) => onCorrect(candidate.id, field, event.target.value === '' ? null : Number(event.target.value))}
                      />
                      {candidate.corrections[field] !== undefined && (
                        <div style={{ color: '#e0b341', fontSize: '0.62rem' }}>corrected</div>
                      )}
                    </td>
                  ))}
                  <td style={cell}>
                    <a href={candidate.source.url} target="_blank" rel="noopener noreferrer" style={{ color: '#7bb7c4' }}>
                      {candidate.source.manufacturer}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        data-testid="vehicle-review-publish"
        onClick={onPublish}
        disabled={publishing || tickedCount === 0}
        style={{
          justifySelf: 'start',
          background: tickedCount ? '#222' : 'transparent',
          border: '1px solid #444',
          color: tickedCount ? '#fff' : '#777',
          borderRadius: '6px',
          padding: '0.35rem 0.7rem',
          fontWeight: 700,
          fontSize: '0.74rem',
          cursor: publishing || !tickedCount ? 'default' : 'pointer',
        }}
      >
        {publishing ? 'Publishing…' : `Publish ${tickedCount} ${make} ${tickedCount === 1 ? 'vehicle' : 'vehicles'}`}
      </button>
    </div>
  );
}
