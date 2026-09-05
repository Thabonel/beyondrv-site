/**
 * Google's quick-create card, and the same card again for editing. Title
 * first and focused, then when, then what kind of thing it is.
 */
import React, { useEffect, useRef, useState } from 'react';
import { CREATABLE_KINDS, EVENT_KIND_META, ORDER_DATE_KINDS, TIMED_RECORD_KINDS, type AdminCalendarEvent } from './calendar-model';

export interface EventFormValues {
  title: string;
  kind: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  notes: string;
  orderId: string;
}

export interface OrderOption { id: string; label: string }

interface Props {
  mode: 'create' | 'edit';
  initial: EventFormValues;
  /** The event being edited, when mode is edit. */
  event?: AdminCalendarEvent | null;
  orders: OrderOption[];
  onLoadOrders: () => void;
  onSubmit: (values: EventFormValues) => Promise<void>;
  onCancel: () => void;
}

export default function EventForm({ mode, initial, event, orders, onLoadOrders, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<EventFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  const editingRecord = mode === 'edit' && event?.recordType !== 'calendar';
  const canHoldTime = !editingRecord || (event ? TIMED_RECORD_KINDS.has(event.kind) : true);
  const kindLabel = event ? EVENT_KIND_META[event.kind].label : '';

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    if (ORDER_DATE_KINDS.has(values.kind) && !orders.length) onLoadOrders();
  }, [values.kind, orders.length, onLoadOrders]);

  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(formEvent: React.SyntheticEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError('');
    const needsTitle = !editingRecord && !(ORDER_DATE_KINDS.has(values.kind) && mode === 'create');
    if (needsTitle && !values.title.trim()) { setError('Give it a title.'); return; }
    if (ORDER_DATE_KINDS.has(values.kind) && mode === 'create' && !values.orderId) {
      setError(values.kind === 'expected_handover' ? 'Choose the order being handed over.' : 'Choose the order the customer is visiting for.');
      return;
    }
    if (!values.allDay && values.endTime && values.endTime <= values.startTime) { setError('The end is before the start.'); return; }
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setSaving(false);
    }
  }

  return (
    <form className="gcal-form" onSubmit={submit} data-testid="event-form">
      {editingRecord ? (
        <div className="gcal-form__record">
          <span className="gcal-form__chip" style={{ background: event ? EVENT_KIND_META[event.kind].colour : '#616161' }}>{kindLabel}</span>
          <strong>{event?.title}</strong>
          <span className="gcal-muted">Lives on the {event?.recordType} {event?.recordId}. Only the date{canHoldTime ? ' and time' : ''} can change here.</span>
        </div>
      ) : ORDER_DATE_KINDS.has(values.kind) && mode === 'create' ? (
        <div className="gcal-form__title gcal-muted" data-testid="event-title-from-order">
          {values.kind === 'expected_handover' ? 'Handover' : 'Customer visit'} · named by the order below
        </div>
      ) : (
        <input
          ref={titleRef}
          className="gcal-form__title"
          placeholder="Add title"
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          aria-label="Title"
          data-testid="event-title"
        />
      )}

      {mode === 'create' && (
        <div className="gcal-form__kinds" role="radiogroup" aria-label="Kind">
          {CREATABLE_KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={values.kind === option.value}
              className={values.kind === option.value ? 'is-on' : ''}
              style={values.kind === option.value ? { background: EVENT_KIND_META[option.value].colour, borderColor: EVENT_KIND_META[option.value].colour } : undefined}
              onClick={() => set('kind', option.value)}
            >{option.label}</button>
          ))}
        </div>
      )}

      {ORDER_DATE_KINDS.has(values.kind) && mode === 'create' && (
        <label className="gcal-form__field">
          <span>Order</span>
          <select value={values.orderId} onChange={(e) => set('orderId', e.target.value)} data-testid="event-order">
            <option value="">{orders.length ? 'Choose an order' : 'Loading orders…'}</option>
            {orders.map((order) => <option key={order.id} value={order.id}>{order.label}</option>)}
          </select>
        </label>
      )}

      <div className="gcal-form__when">
        <span aria-hidden="true">🕒</span>
        <input type="date" value={values.date} onChange={(e) => set('date', e.target.value)} aria-label="Date" data-testid="event-date" required />
        {!values.allDay && canHoldTime && (
          <>
            <input type="time" step={900} value={values.startTime} onChange={(e) => set('startTime', e.target.value)} aria-label="Start time" data-testid="event-start" />
            <span>–</span>
            <input type="time" step={900} value={values.endTime} onChange={(e) => set('endTime', e.target.value)} aria-label="End time" data-testid="event-end" />
          </>
        )}
      </div>
      {canHoldTime && (
        <label className="gcal-form__allday">
          <input type="checkbox" checked={values.allDay} onChange={(e) => set('allDay', e.target.checked)} /> All day
        </label>
      )}

      {!editingRecord && (
        <textarea
          className="gcal-form__notes"
          placeholder="Add description"
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          aria-label="Description"
        />
      )}

      {error && <div className="gcal-form__error" role="alert">{error}</div>}

      <div className="gcal-form__actions">
        <button type="button" className="gcal-btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="gcal-btn gcal-btn--primary" disabled={saving} data-testid="event-save">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
