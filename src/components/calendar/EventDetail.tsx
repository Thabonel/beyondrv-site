/** The card that opens when an event is clicked: what, when, where it came from. */
import React from 'react';
import { EVENT_KIND_META, formatWhen, MOVABLE_RECORD_KINDS, type AdminCalendarEvent } from './calendar-model';

export interface StoredDetail {
  notes?: string;
  location?: string;
  sourceEmail?: { subject: string; from: string; excerpt: string };
  links?: { orderId?: string; enquiryId?: string; productSlug?: string };
}

interface Props {
  event: AdminCalendarEvent;
  stored?: StoredDetail | null;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const RECORD_HOME: Record<AdminCalendarEvent['recordType'], string> = {
  order: 'Orders', enquiry: 'Enquiries', task: 'Tasks', product: 'Products', calendar: 'the calendar',
};

export default function EventDetail({ event, stored, onEdit, onDelete, onClose }: Props) {
  const meta = EVENT_KIND_META[event.kind];
  const isStore = event.recordType === 'calendar';
  const movable = isStore || MOVABLE_RECORD_KINDS.has(event.kind);
  const links = stored?.links ?? {};

  return (
    <div className="gcal-detail" data-testid="event-detail">
      <div className="gcal-detail__actions">
        {movable && <button type="button" className="gcal-icon-btn" aria-label="Edit" title="Edit" onClick={onEdit}>✎</button>}
        {isStore && (
          <button type="button" className="gcal-icon-btn" aria-label={event.source === 'ai' ? 'Dismiss' : 'Delete'} title={event.source === 'ai' ? 'Dismiss' : 'Delete'} onClick={onDelete}>🗑</button>
        )}
        <button type="button" className="gcal-icon-btn" aria-label="Close" title="Close" onClick={onClose}>×</button>
      </div>
      <div className="gcal-detail__head">
        <span className="gcal-detail__swatch" style={{ background: meta.colour }} />
        <div>
          <div className="gcal-detail__title">{event.title}</div>
          <div className="gcal-detail__when">{formatWhen(event)}</div>
        </div>
      </div>
      <div className="gcal-detail__rows">
        <div><span className="gcal-detail__chip" style={{ background: meta.colour }}>{meta.label}</span>{event.isCommitment && <span className="gcal-detail__commit">Commitment to a customer</span>}</div>
        {event.detail && <div>{event.detail}</div>}
        {stored?.notes && <div className="gcal-detail__notes">{stored.notes}</div>}
        {stored?.location && <div>📍 {stored.location}</div>}
        {event.source === 'ai' && (
          <div className="gcal-detail__ai">
            <div><span className="gcal-ai-badge">✦ Added by AI</span> from the mailbox</div>
            {stored?.sourceEmail && (
              <>
                <div><strong>{stored.sourceEmail.subject}</strong> · {stored.sourceEmail.from}</div>
                {stored.sourceEmail.excerpt && <blockquote>“{stored.sourceEmail.excerpt}”</blockquote>}
              </>
            )}
          </div>
        )}
        {event.source === 'chat' && <div className="gcal-muted">Added by the admin assistant.</div>}
        {(links.orderId || links.productSlug || links.enquiryId) && (
          <div className="gcal-muted">
            Related: {[links.orderId && `order ${links.orderId}`, links.productSlug && `product ${links.productSlug}`, links.enquiryId && `enquiry ${links.enquiryId}`].filter(Boolean).join(' · ')}
          </div>
        )}
        {!isStore && (
          <div className="gcal-muted">
            {movable
              ? `Lives on the ${event.recordType} ${event.recordId}. Drag it or edit it here and ${RECORD_HOME[event.recordType]} updates.`
              : `A container ETA lives on the product file and reaches the site through Pending review. Change it in Products.`}
          </div>
        )}
      </div>
    </div>
  );
}
