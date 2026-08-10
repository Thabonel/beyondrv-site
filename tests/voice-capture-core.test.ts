import assert from 'node:assert/strict';
import test from 'node:test';
import { normaliseAudioMimeType, normaliseVoiceProposal, voiceCaptureSummary } from '../netlify/functions/voice-capture-core.ts';

test('voice proposal keeps only supported, bounded fields and safe date values', () => {
  const proposal = normaliseVoiceProposal({
    summary: 'Spoke to Alex about a camper.', customerName: 'Alex Smith', productInterest: '3.5m pop-top',
    followUpDate: '2026-08-20', followUpReason: 'Send photos', appointmentDateTime: 'Tuesday 10am',
    moneyMentions: [{ amountText: '$148,500', meaning: 'quoted total', sourceExcerpt: 'quoted one hundred and forty-eight thousand five hundred' }],
    discussedItems: ['Diesel heating'], unresolvedItems: ['Cabinet colour'], requiresAgreementReview: true, confidence: 'high',
  });
  assert.equal(proposal.followUpDate, '2026-08-20');
  assert.equal(proposal.moneyMentions[0].amountText, '$148,500');
  assert.equal(proposal.requiresAgreementReview, true);
  assert.match(voiceCaptureSummary(proposal), /Still to confirm: Cabinet colour/);
});

test('voice proposal rejects untrusted dates and unknown confidence values', () => {
  const proposal = normaliseVoiceProposal({ summary: 'Call note', followUpDate: 'next Tuesday', confidence: 'certain', moneyMentions: [{ amountText: 100 }] });
  assert.equal(proposal.followUpDate, '');
  assert.equal(proposal.confidence, 'medium');
  assert.equal(proposal.moneyMentions.length, 0);
});

test('Android WebM recordings retain their supported media type when Chrome adds codecs', () => {
  assert.equal(normaliseAudioMimeType('audio/webm;codecs=opus'), 'audio/webm');
  assert.equal(normaliseAudioMimeType(' Audio/MP4 ; codecs=mp4a.40.2'), 'audio/mp4');
});
