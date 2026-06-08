import type { Handler } from '@netlify/functions';
import { isAdminAuthorized, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import {
  newOwnerCopilotId,
  OWNER_COPILOT_AI_ACTION_STORE,
  OWNER_COPILOT_AUDIT_STORE,
  OWNER_COPILOT_DRIVE_FILE_STORE,
  OWNER_COPILOT_GMAIL_THREAD_STORE,
  OWNER_COPILOT_LEAD_STORE,
  OWNER_COPILOT_TASK_STORE,
  OWNER_COPILOT_WEEKLY_REPORT_STORE,
  weeklyReportKey,
} from './owner-copilot-core';
import { appendOwnerAudit, clean, listJsonStore } from './owner-copilot-store-utils';

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfWindow(days = 7) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function inWindow(value: unknown, start: Date) {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time >= start.getTime();
}

function isOpenStatus(status: unknown) {
  return !['won', 'lost', 'spam', 'completed', 'cancelled'].includes(String(status || '').toLowerCase());
}

function reportLine(title: string, value: number, detail: string) {
  return { title, value, detail };
}

async function generateReport(days = 7) {
  const start = startOfWindow(days);
  const [leads, tasks, aiActions, audits, gmailThreads, driveFiles] = await Promise.all([
    listJsonStore(OWNER_COPILOT_LEAD_STORE).catch(() => []),
    listJsonStore(OWNER_COPILOT_TASK_STORE).catch(() => []),
    listJsonStore(OWNER_COPILOT_AI_ACTION_STORE).catch(() => []),
    listJsonStore(OWNER_COPILOT_AUDIT_STORE).catch(() => []),
    listJsonStore(OWNER_COPILOT_GMAIL_THREAD_STORE).catch(() => []),
    listJsonStore(OWNER_COPILOT_DRIVE_FILE_STORE).catch(() => []),
  ]);

  const newLeads = leads.filter(lead => inWindow(lead.createdAt || lead.updatedAt, start));
  const openLeads = leads.filter(lead => isOpenStatus(lead.status));
  const hotLeads = openLeads.filter(lead => Number(lead.score || 0) >= 75 || String(lead.status || '').toLowerCase() === 'hot');
  const staleLeads = openLeads.filter(lead => typeof lead.nextFollowUpDate === 'string' && lead.nextFollowUpDate < dateOnly(new Date()));
  const openTasks = tasks.filter(task => task.status === 'open');
  const overdueTasks = openTasks.filter(task => typeof task.dueDate === 'string' && task.dueDate < dateOnly(new Date()));
  const completedTasks = tasks.filter(task => task.status === 'completed' && inWindow(task.completedAt || task.updatedAt, start));
  const draftActivity = aiActions.filter(action => inWindow(action.createdAt, start));
  const approvalNeeded = aiActions.filter(action => ['draft', 'edited'].includes(String(action.approvalState || 'draft')));
  const recentAudits = audits.filter(audit => inWindow(audit.createdAt, start));
  const linkedThreads = gmailThreads.filter(thread => ['approved', 'pinned'].includes(String(thread.matchDecision || '')));
  const unreviewedThreads = gmailThreads.filter(thread => !thread.matchDecision && Array.isArray(thread.suggestions) && thread.suggestions.length);
  const linkedFiles = driveFiles.filter(file => ['approved', 'pinned'].includes(String(file.matchDecision || '')));
  const unreviewedFiles = driveFiles.filter(file => !file.matchDecision && Array.isArray(file.suggestions) && file.suggestions.length);

  const recommendations = [
    hotLeads.length > 0 && `Review ${hotLeads.length} hot lead${hotLeads.length === 1 ? '' : 's'} and make sure each has a next action.`,
    staleLeads.length > 0 && `Clear ${staleLeads.length} stale follow-up${staleLeads.length === 1 ? '' : 's'} before adding new automation.`,
    overdueTasks.length > 0 && `Complete, snooze, or cancel ${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'}.`,
    approvalNeeded.length > 0 && `Review ${approvalNeeded.length} stored AI draft${approvalNeeded.length === 1 ? '' : 's'} before using them with customers.`,
    unreviewedThreads.length > 0 && `Confirm or reject ${unreviewedThreads.length} Gmail match suggestion${unreviewedThreads.length === 1 ? '' : 's'}.`,
    unreviewedFiles.length > 0 && `Confirm or reject ${unreviewedFiles.length} Drive file suggestion${unreviewedFiles.length === 1 ? '' : 's'}.`,
  ].filter(Boolean) as string[];

  return {
    id: newOwnerCopilotId('weekly_report'),
    periodStart: dateOnly(start),
    periodEnd: dateOnly(new Date()),
    generatedAt: new Date().toISOString(),
    sections: [
      reportLine('New leads', newLeads.length, `${openLeads.length} open leads total.`),
      reportLine('Hot leads', hotLeads.length, `${staleLeads.length} open leads have overdue follow-up dates.`),
      reportLine('Tasks completed', completedTasks.length, `${openTasks.length} open tasks, ${overdueTasks.length} overdue.`),
      reportLine('AI drafts', draftActivity.length, `${approvalNeeded.length} drafts still need owner review.`),
      reportLine('Gmail matches', linkedThreads.length, `${unreviewedThreads.length} Gmail suggestions need review.`),
      reportLine('Drive matches', linkedFiles.length, `${unreviewedFiles.length} Drive suggestions need review.`),
      reportLine('Audit events', recentAudits.length, 'Recent owner/admin system activity recorded.'),
    ],
    recommendations: recommendations.length ? recommendations : ['No urgent owner-copilot actions detected for this period.'],
    sourceCounts: {
      leads: leads.length,
      tasks: tasks.length,
      aiActions: aiActions.length,
      audits: audits.length,
      gmailThreads: gmailThreads.length,
      driveFiles: driveFiles.length,
    },
  };
}

export const handler: Handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  if (!isAdminAuthorized(event)) return unauthorizedResponse();
  connectBlobStore(event);

  try {
    const store = getBlobStore(OWNER_COPILOT_WEEKLY_REPORT_STORE);

    if (event.httpMethod === 'GET') {
      const reports = (await listJsonStore(OWNER_COPILOT_WEEKLY_REPORT_STORE))
        .sort((a, b) => String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')))
        .slice(0, 12);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reports }) };
    }

    let days = 7;
    try {
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      days = Math.max(1, Math.min(31, Number(clean(body.days, 4)) || 7));
    } catch {}

    const report = await generateReport(days);
    await store.setJSON(weeklyReportKey(report.id), report);
    await appendOwnerAudit('weekly_report_generated', 'weekly_report', report.id, { periodStart: report.periodStart, periodEnd: report.periodEnd });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, report }) };
  } catch (error) {
    console.warn('admin-weekly-report: unavailable', { error: safeBlobStoreError(error) });
    return { statusCode: 503, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: blobStoreUserMessage(error) }) };
  }
};
