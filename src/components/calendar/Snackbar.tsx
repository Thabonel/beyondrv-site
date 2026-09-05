/** Google's bottom-left toast, with the Undo that makes a drag safe to try. */
import React, { useEffect } from 'react';

export interface SnackbarState {
  message: string;
  tone?: 'info' | 'error';
  undo?: () => void;
}

interface Props {
  state: SnackbarState | null;
  onClose: () => void;
}

export default function Snackbar({ state, onClose }: Props) {
  useEffect(() => {
    if (!state) return;
    const timer = window.setTimeout(onClose, state.undo ? 8000 : 5000);
    return () => window.clearTimeout(timer);
  }, [state, onClose]);

  if (!state) return null;
  return (
    <div className={`gcal-snackbar${state.tone === 'error' ? ' is-error' : ''}`} role="status" data-testid="calendar-status">
      <span>{state.message}</span>
      {state.undo && (
        <button type="button" onClick={() => { state.undo?.(); onClose(); }}>Undo</button>
      )}
      <button type="button" aria-label="Dismiss" onClick={onClose}>×</button>
    </div>
  );
}
