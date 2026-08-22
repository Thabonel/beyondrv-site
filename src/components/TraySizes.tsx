import React from 'react';

export interface TraySizeBucket {
  lengthMm: number;
  widthMm: number;
  reports: number;
  lastReportedAt: string;
}

export interface TraySizeRecord {
  variantId: string;
  /** The picker's own label; falls back to the id if the vehicle has gone. */
  label?: string;
  sizes: TraySizeBucket[];
  totalReports: number;
}

export function traySizeKeyFor(variantId: string, size: TraySizeBucket) {
  return `${variantId}:${size.lengthMm}x${size.widthMm}`;
}

export default function TraySizes({
  records, loading, error, deletingKey, onDelete,
}: {
  records: TraySizeRecord[];
  loading: boolean;
  error: string;
  deletingKey: string | null;
  onDelete: (variantId: string, size: TraySizeBucket) => void;
}) {
  if (loading && records.length === 0) {
    return <p style={{ margin: 0, color: '#888', fontSize: '0.78rem' }}>Loading reported tray sizes…</p>;
  }
  if (error) {
    return <p style={{ margin: 0, color: '#f87171', fontSize: '0.78rem' }}>{error}</p>;
  }
  if (records.length === 0) {
    return (
      <p style={{ margin: 0, color: '#777', fontSize: '0.78rem' }}>
        No tray sizes reported yet. Customers add these from the slide-on weight calculator.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {records.map((record) => (
        <div key={record.variantId} style={{ borderBottom: '1px solid #252525', paddingBottom: '0.6rem' }}>
          <div style={{ color: '#fff', fontSize: '0.76rem', fontWeight: 800, lineHeight: 1.35 }}>{record.label ?? record.variantId}</div>
          {record.sizes.map((size) => {
            const key = traySizeKeyFor(record.variantId, size);
            return (
              <div
                key={key}
                data-testid="tray-size-row"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '0.5rem', marginTop: '0.35rem',
                }}
              >
                <span style={{ color: '#ddd', fontSize: '0.76rem' }}>
                  {size.lengthMm} × {size.widthMm} mm · {size.reports} report{size.reports === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(record.variantId, size)}
                  disabled={deletingKey === key}
                  style={{
                    background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px',
                    padding: '0.25rem 0.5rem', cursor: deletingKey === key ? 'wait' : 'pointer',
                    fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap',
                  }}
                >
                  {deletingKey === key ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
