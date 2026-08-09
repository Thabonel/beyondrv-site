import type { Handler } from '@netlify/functions';
import { forbiddenResponse, getAdminActor, hasAdminCapability, unauthorizedResponse } from './admin-auth';
import { blobStoreUserMessage, connectBlobStore, getBlobStore, safeBlobStoreError } from './blob-store';
import { appendOwnerAudit, appendOwnerTimeline } from './owner-copilot-store-utils';
import type { ConfigurationRecord, ConfigurationSnapshot } from '../../src/lib/configurator/types.ts';
import { CONTRACT_STORE, contractKey, normaliseContractInput, validateContract } from './contract-core.ts';
import { CONFIGURATION_STORE, configurationKey, configurationSnapshotToContractInput, hydrateConfigurationRecord } from './configuration-core.ts';
import { getEffectiveConfiguratorCatalogue } from './configurator-catalogue-core.ts';
import { appendSalesActivity, buildSalesActivityEvent } from './sales-activity-core';

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' },
    body: JSON.stringify(body),
  };
}

function clean(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function readBody(raw: string | null) {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const actor = getAdminActor(event);
  if (!actor) return unauthorizedResponse();
  if (!hasAdminCapability(actor, 'configurations:write')) return forbiddenResponse('configurations:write');
  if (!hasAdminCapability(actor, 'agreements:write')) return forbiddenResponse('agreements:write');
  const blobRuntimeSource = connectBlobStore(event);
  const body = readBody(event.body);
  if (!body) return json(400, { error: 'Invalid JSON request.' });
  const id = clean(body.id);
  if (!id) return json(400, { error: 'Missing configuration id.' });

  try {
    const configurationStore = getBlobStore(CONFIGURATION_STORE);
    const { catalogue } = await getEffectiveConfiguratorCatalogue();
    if (!['approved_internal', 'approved_public'].includes(catalogue.readiness)) {
      return json(409, { error: 'The pilot catalogue must be owner-approved before it can create a live contract draft.' });
    }
    const rawConfiguration = await configurationStore.get(configurationKey(id), { type: 'json' }) as ConfigurationRecord | null;
    const configuration = rawConfiguration ? hydrateConfigurationRecord(rawConfiguration) : null;
    if (!configuration) return json(404, { error: 'Configuration not found.' });
    if (configuration.status !== 'approved') return json(409, { error: 'Approve the internal configuration before creating a contract draft.' });
    if (configuration.customerReview.status !== 'approved') return json(409, { error: 'The customer must approve the configuration review before a contract draft can be created.' });
    if (!configuration.approvedSnapshotKey || !configuration.approvedSnapshotDigest) return json(409, { error: 'The approved configuration snapshot is missing.' });
    if (configuration.linkedContractIds.length) return json(409, { error: 'This configuration already has a linked contract. Open Contracts to continue.' });

    const snapshot = await configurationStore.get(configuration.approvedSnapshotKey, { type: 'json' }) as ConfigurationSnapshot | null;
    if (!snapshot || snapshot.digest !== configuration.approvedSnapshotDigest) return json(409, { error: 'The approved configuration snapshot could not be verified.' });

    const contract = normaliseContractInput(configurationSnapshotToContractInput(snapshot, catalogue), null, { actorUserId: actor.id });
    const validation = validateContract(contract);
    const contractStore = getBlobStore(CONTRACT_STORE);
    await contractStore.setJSON(contractKey(contract.id), contract);
    const updatedConfiguration: ConfigurationRecord = {
      ...configuration,
      status: 'converted_to_contract',
      linkedContractIds: [contract.id],
      updatedAt: new Date().toISOString(),
      updatedBy: actor.id,
    };
    await configurationStore.setJSON(configurationKey(configuration.id), updatedConfiguration);
    await Promise.all([
      appendOwnerAudit('configuration_converted_to_contract', 'configuration', configuration.id, {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        configurationNumber: configuration.configurationNumber,
        revision: configuration.revision,
        snapshotDigest: configuration.approvedSnapshotDigest,
      }, actor),
      appendOwnerAudit('contract_created_from_configuration', 'contract', contract.id, {
        configurationId: configuration.id,
        configurationNumber: configuration.configurationNumber,
        configuredTotalCents: snapshot.pricing.configuredTotalCents,
      }, actor),
      appendOwnerTimeline('configuration_converted_to_contract', `${configuration.configurationNumber} revision ${configuration.revision} converted to contract ${contract.contractNumber}.`, {
        relatedLeadId: configuration.leadId,
        relatedCustomerId: configuration.customerId,
        source: 'admin-configuration-contract',
      }),
      appendSalesActivity(buildSalesActivityEvent({
        activityType: 'agreement_created_from_configuration',
        summary: `${configuration.configurationNumber} converted to agreement ${contract.contractNumber}.`,
        customerId: configuration.customerId,
        opportunityId: contract.opportunityId,
        enquiryId: contract.sourceEnquiryId,
        agreementId: contract.id,
        configurationId: configuration.id,
        source: 'gm_ui',
        metadata: { configurationRevision: configuration.revision, snapshotDigest: configuration.approvedSnapshotDigest },
      }, actor)),
    ]);

    return json(201, { ok: true, configuration: updatedConfiguration, contract, validation });
  } catch (error) {
    console.warn('admin-configuration-contract: unavailable', { blobRuntimeSource, error: safeBlobStoreError(error) });
    return json(503, { error: blobStoreUserMessage(error) });
  }
};
