/**
 * A floating card anchored to whatever was clicked, as Google's event and
 * quick-create cards are. Prefers the right of the anchor, then the left, then
 * below, and stays inside the viewport. On a phone it is a bottom sheet.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PHONE_QUERY, type AnchorRect } from './calendar-model';

interface Props {
  anchor: AnchorRect;
  width?: number;
  onClose: () => void;
  children: React.ReactNode;
  label: string;
  testId?: string;
}

const GAP = 12;
const MARGIN = 8;

export default function Popover({ anchor, width = 400, onClose, children, label, testId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const phone = typeof window !== 'undefined' && window.matchMedia?.(PHONE_QUERY).matches;

  useLayoutEffect(() => {
    if (phone) { setStyle({}); return; }
    const element = ref.current;
    if (!element) return;

    function place() {
      const height = element!.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const available = vh - MARGIN * 2;
      let left = anchor.left + anchor.width + GAP;
      if (left + width > vw - MARGIN) left = anchor.left - width - GAP;
      let top = anchor.top;
      if (left < MARGIN) {
        left = Math.max(MARGIN, Math.min(anchor.left, vw - width - MARGIN));
        top = anchor.top + anchor.height + GAP;
      }
      if (top + height > vh - MARGIN) top = Math.max(MARGIN, vh - height - MARGIN);
      // Taller than the window: pin it to the top and let it scroll inside
      // itself, so Save is always reachable.
      setStyle({ top, left, width, maxHeight: available, overflowY: height > available ? 'auto' : undefined });
    }

    place();
    // The card grows when a kind is picked, an order list loads, or an error
    // appears. Measuring only on open left Save off the bottom of the screen.
    const observer = new ResizeObserver(place);
    observer.observe(element);
    window.addEventListener('resize', place);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); };
  }, [anchor, width, phone]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    }
    function onDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    window.addEventListener('keydown', onKey, true);
    // Deferred so the click that opened the card does not immediately close it.
    const timer = window.setTimeout(() => window.addEventListener('mousedown', onDown), 0);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearTimeout(timer);
      window.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      data-testid={testId}
      className={phone ? 'gcal-popover gcal-popover--sheet' : 'gcal-popover'}
      style={style}
    >
      {children}
    </div>
  );
}
