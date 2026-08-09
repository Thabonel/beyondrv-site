import React, { useRef, useState } from 'react';
import { adminFetch, adminJson } from '../lib/adminApi';

type Proposal = {
  summary: string; customerName: string; productInterest: string; followUpDate: string; followUpReason: string; appointmentDateTime: string;
  moneyMentions: Array<{ amountText: string; meaning: string; sourceExcerpt: string }>;
  discussedItems: string[]; unresolvedItems: string[]; requiresAgreementReview: boolean; confidence: 'high' | 'medium' | 'low';
};
type Capture = { id: string; transcript: string; proposal: Proposal; status: string };

function createIdempotencyKey() { return typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }

export default function QuickVoiceCapture() {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typedNote, setTypedNote] = useState('');
  const [status, setStatus] = useState('Tap the microphone after your customer call, then dictate what happened.');
  const [error, setError] = useState('');
  const [capture, setCapture] = useState<Capture | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [summary, setSummary] = useState('');
  const [productInterest, setProductInterest] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpReason, setFollowUpReason] = useState('');

  function stopStream() { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; }
  function loadCapture(next: Capture) {
    setCapture(next); setCustomerName(next.proposal.customerName); setSummary(next.proposal.summary); setProductInterest(next.proposal.productInterest); setFollowUpDate(next.proposal.followUpDate); setFollowUpReason(next.proposal.followUpReason);
  }

  async function understand(input: { transcript?: string; audioBase64?: string; mimeType?: string }) {
    setBusy(true); setError(''); setStatus(input.audioBase64 ? 'Transcribing your call note…' : 'Understanding your typed note…');
    try {
      const response = await adminFetch('/.netlify/functions/admin-voice-capture-extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, idempotencyKey: createIdempotencyKey() }) });
      const body = await adminJson<{ capture?: Capture }>(response, 'Could not understand that call note');
      if (!response.ok || !body.capture) throw new Error(body.error || 'Could not understand that call note.');
      loadCapture(body.capture); setStatus('Here is what I understood. Check the highlighted details before saving.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not understand that call note.'); setStatus('You can try again or type the note instead.'); }
    finally { setBusy(false); }
  }

  async function startRecording() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Recording is not supported by this browser. Use the typed fallback below.'); return; }
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = nextStream; chunks.current = [];
      const nextRecorder = new MediaRecorder(nextStream);
      nextRecorder.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      nextRecorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: nextRecorder.mimeType || 'audio/webm' });
        stopStream();
        const reader = new FileReader();
        reader.onload = () => { const dataUrl = String(reader.result || ''); void understand({ audioBase64: dataUrl.split(',')[1] || '', mimeType: blob.type || 'audio/webm' }); };
        reader.onerror = () => { setError('Could not read that recording. Please try again or type the note.'); };
        reader.readAsDataURL(blob);
      };
      recorder.current = nextRecorder; nextRecorder.start(); setRecording(true); setStatus('Recording. Speak normally, then tap Finish recording.');
    } catch (reason) { setError(reason instanceof DOMException && reason.name === 'NotAllowedError' ? 'Microphone permission was denied. You can allow it in Safari settings or use the typed fallback.' : 'Could not start the microphone. Use the typed fallback if needed.'); }
  }

  function finishRecording() { recorder.current?.stop(); recorder.current = null; setRecording(false); setStatus('Preparing your call note…'); }
  function clearCapture() { stopStream(); recorder.current = null; setRecording(false); setCapture(null); setTypedNote(''); setError(''); setStatus('Tap the microphone after your customer call, then dictate what happened.'); }

  async function discardAndRestart() {
    if (!capture || busy) return;
    setBusy(true); setError('');
    try {
      const response = await adminFetch('/.netlify/functions/admin-voice-capture-discard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captureId: capture.id }) });
      const body = await adminJson(response, 'Could not discard the call note');
      if (!response.ok) throw new Error(body.error || 'Could not discard the call note.');
      clearCapture();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not discard the call note.'); }
    finally { setBusy(false); }
  }

  async function saveEverything() {
    if (!capture || busy) return;
    setBusy(true); setError(''); setStatus('Saving the confirmed call note…');
    try {
      const response = await adminFetch('/.netlify/functions/admin-voice-capture-confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captureId: capture.id, customerName, customerPhone, customerEmail, summary, productInterest, followUpDate, followUpReason }) });
      const body = await adminJson<{ result?: { message?: string } }>(response, 'Could not save the call note');
      if (!response.ok) throw new Error(body.error || 'Could not save the call note.');
      setStatus(body.result?.message || 'Call note saved.'); setCapture(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save the call note.'); setStatus('Nothing has been duplicated. Try Save Everything again.'); }
    finally { setBusy(false); }
  }

  return <main className="voice-page">
    <style>{`
      .voice-page{min-height:100vh;background:#0a0a0a;color:#fff;font-family:Outfit,system-ui,sans-serif;padding:18px 14px 36px}.voice-shell{max-width:640px;margin:0 auto}.voice-back{color:#fbbf24;text-decoration:none;font-weight:800;font-size:14px}.voice-kicker{color:#fb923c;text-transform:uppercase;font-weight:900;letter-spacing:.08em;font-size:12px;margin-top:22px}.voice-page h1{font-size:clamp(30px,9vw,46px);line-height:1.02;margin:6px 0 10px}.voice-intro,.voice-status{color:#bbb;line-height:1.5}.voice-status{padding:12px 14px;border:1px solid #333;border-radius:12px;background:#141414;margin:18px 0}.voice-error{color:#fecaca;background:#3b1010;border:1px solid #7f1d1d;border-radius:12px;padding:12px 14px;line-height:1.4}.voice-mic{width:100%;min-height:174px;border-radius:24px;margin:18px 0;border:2px solid #e8540a;background:#e8540a;color:#fff;font:inherit;font-size:23px;font-weight:900;cursor:pointer}.voice-mic[data-recording="true"]{background:#991b1b;border-color:#fca5a5;animation:pulse 1.1s infinite}.voice-button{min-height:50px;padding:12px 16px;border-radius:11px;border:1px solid #555;background:#222;color:#fff;font:inherit;font-weight:850;cursor:pointer}.voice-button.primary{background:#e8540a;border-color:#e8540a}.voice-button:disabled,.voice-mic:disabled{opacity:.55;cursor:wait}.voice-or{display:flex;gap:10px;align-items:center;color:#999;margin:22px 0}.voice-or:before,.voice-or:after{content:"";height:1px;background:#333;flex:1}.voice-field{display:grid;gap:6px;margin:13px 0;color:#f5d0a9;font-size:14px;font-weight:800}.voice-field input,.voice-field textarea{width:100%;background:#141414;color:#fff;border:1px solid #555;border-radius:10px;padding:12px;font:inherit;font-size:16px}.voice-field textarea{min-height:140px;resize:vertical}.voice-review{margin-top:22px;border:1px solid #ea580c;border-radius:18px;background:#1b120d;padding:16px}.voice-review h2{margin:0 0 5px;font-size:22px}.voice-warning{border-left:4px solid #f59e0b;background:#2d2110;padding:11px;margin:12px 0;color:#fde68a;line-height:1.4}.voice-list{margin:8px 0;padding-left:20px;color:#ddd;line-height:1.5}.voice-actions{display:grid;grid-template-columns:1fr;gap:10px;margin-top:16px}@keyframes pulse{50%{transform:scale(.985);background:#b91c1c}}@media(min-width:520px){.voice-actions{grid-template-columns:1fr 1fr}.voice-actions .primary{grid-column:1/-1}}`}</style>
    <div className="voice-shell">
      <a className="voice-back" href="/admin/">← Sales workspace</a>
      <div className="voice-kicker">Beyond RV</div><h1>Log Customer Call</h1>
      <p className="voice-intro">Dictate what happened. The assistant prepares a note for you to check. Nothing commercial is changed until you confirm.</p>
      <p className="voice-status" aria-live="polite">{status}</p>{error && <p className="voice-error" role="alert">{error}</p>}
      {!capture && <>
        <button type="button" className="voice-mic" data-recording={recording} onClick={recording ? finishRecording : () => void startRecording()} disabled={busy} aria-label={recording ? 'Finish recording' : 'Start recording'}>{recording ? '■ Finish recording' : '● Tap to dictate call note'}</button>
        <div className="voice-or">or type it</div>
        <label className="voice-field">What happened on the call?<textarea value={typedNote} onChange={event => setTypedNote(event.target.value)} placeholder="For example: Spoke to John about the 3.5m pop-top. He wants photos today and will visit Tuesday at 10." /></label>
        <button type="button" className="voice-button" disabled={busy || !typedNote.trim()} onClick={() => void understand({ transcript: typedNote })}>Understand typed note</button>
      </>}
      {capture && <section className="voice-review" aria-labelledby="voice-review-title"><h2 id="voice-review-title">Here is what I understood</h2><p className="voice-intro">Review this before it becomes part of the customer record.</p>
        <label className="voice-field">Customer name<input value={customerName} onChange={event => setCustomerName(event.target.value)} /></label>
        <label className="voice-field">Customer phone <span>(use it to link the existing customer)</span><input inputMode="tel" value={customerPhone} onChange={event => setCustomerPhone(event.target.value)} placeholder="Optional" /></label>
        <label className="voice-field">Customer email <span>(or use this to link)</span><input inputMode="email" value={customerEmail} onChange={event => setCustomerEmail(event.target.value)} placeholder="Optional" /></label>
        <label className="voice-field">Call summary<textarea value={summary} onChange={event => setSummary(event.target.value)} /></label>
        <label className="voice-field">Product discussed<input value={productInterest} onChange={event => setProductInterest(event.target.value)} placeholder="Optional" /></label>
        <label className="voice-field">Promised follow-up date<input type="date" value={followUpDate} onChange={event => setFollowUpDate(event.target.value)} /></label>
        <label className="voice-field">Follow-up reason<input value={followUpReason} onChange={event => setFollowUpReason(event.target.value)} placeholder="Optional" /></label>
        {capture.proposal.moneyMentions.length > 0 && <div className="voice-warning"><strong>Check money mentioned</strong><ul className="voice-list">{capture.proposal.moneyMentions.map((mention, index) => <li key={index}>{mention.amountText}: {mention.meaning || 'mentioned on the call'}</li>)}</ul>Money is stored only in the call note. It does not change a price or agreement.</div>}
        {capture.proposal.appointmentDateTime && <div className="voice-warning"><strong>Appointment mentioned:</strong> {capture.proposal.appointmentDateTime}. Check it before saving.</div>}
        {capture.proposal.unresolvedItems.length > 0 && <div className="voice-warning"><strong>Still to confirm</strong><ul className="voice-list">{capture.proposal.unresolvedItems.map(item => <li key={item}>{item}</li>)}</ul></div>}
        {capture.proposal.requiresAgreementReview && <div className="voice-warning">An agreement was discussed. This call note will not create or change an agreement automatically.</div>}
        <div className="voice-actions"><button type="button" className="voice-button" disabled={busy} onClick={() => void discardAndRestart()}>Discard / re-record</button><button type="button" className="voice-button primary" disabled={busy || !summary.trim()} onClick={() => void saveEverything()}>Correct — Save Everything</button></div>
      </section>}
    </div>
  </main>;
}
