import axios from 'axios';
import { executionError, readWarnings } from './results.ts';

// The Elwood Runtime API base URL.
// In development: run `dotnet run` on Elwood.Runtime.Api (defaults to http://localhost:5000).
// In production: set NEXT_PUBLIC_API_URL environment variable.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export interface ManagementSession { name: string; permissions: string[]; pipelines: string[] }
let managementToken = '';
export function setManagementToken(token: string) {
  managementToken = token;
  if (typeof window !== 'undefined') {
    if (token) sessionStorage.setItem('elwood-management-token', token);
    else sessionStorage.removeItem('elwood-management-token');
  }
}
api.interceptors.request.use(config => {
  if (managementToken) config.headers.Authorization = `Bearer ${managementToken}`;
  return config;
});
api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && typeof window !== 'undefined')
    window.dispatchEvent(new Event('elwood-session-expired'));
  return Promise.reject(error);
});
export async function getManagementSession(): Promise<ManagementSession> {
  return (await api.get('/api/session')).data;
}
export function apiError(error: unknown): string {
  return axios.isAxiosError(error)
    ? error.response?.data?.error || error.response?.data?.errors?.join('; ') || error.message
    : error instanceof Error ? error.message : 'Request failed';
}
export function canManage(session: ManagementSession | null, operation: string, pipeline?: string): boolean {
  return !!session?.permissions.some(value => value.toLowerCase() === operation.toLowerCase()) &&
    (!pipeline || session.pipelines.includes('*') || session.pipelines.some(value => value.toLowerCase() === pipeline.toLowerCase()));
}

// ── Types ──

export interface PipelineSummary {
  id: string;
  name: string;
  description?: string;
  sourceCount: number;
  outputCount: number;
  lastModified: string;
  draftRevisionId: string;
  activeRevisionId?: string;
  migrationRequired: boolean;
}

export interface PipelineDefinition {
  id: string;
  content: PipelineContent;
  lastModified: string;
  draftRevisionId: string;
  activeRevisionId?: string;
  migrationRequired: boolean;
}

export interface PipelineContent {
  yaml: string;
  scripts: Record<string, string>;
}

export interface PipelineRevision {
  revisionId: string;
  author?: string;
  message?: string;
  timestamp: string;
}

export interface ExecutionState {
  executionId: string;
  pipelineName: string;
  pipelineId?: string;
  revisionId?: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Retrying' | 'AwaitingReview' | number;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  sources: Record<string, SourceStepState>;
  outputs: Record<string, OutputStepState>;
  errors: string[];
  isTest?: boolean;
  testMode?: TestMode;
  durable?: boolean;
  replayOf?: string;
  expiresAt?: string;
  retentionSeconds?: number;
}

export interface StepAttempt {
  attemptId: string;
  number: number;
  status: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  diagnostics: StepDiagnostic[];
  calls: ConnectorCall[];
}

export interface StepDiagnostic {
  reference: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface SourceStepState {
  sourceName: string;
  status: string | number;
  startedAt?: string;
  completedAt?: string;
  errors: string[];
  diagnostics?: StepDiagnostic[];
  documentRef?: string;
  attempts?: StepAttempt[];
  nextAttemptAt?: string;
  outcomeUncertain?: boolean;
}

export interface OutputStepState {
  outputName: string;
  status: string | number;
  startedAt?: string;
  completedAt?: string;
  errors: string[];
  diagnostics?: StepDiagnostic[];
  documentRef?: string;
  attempts?: StepAttempt[];
  nextAttemptAt?: string;
  outcomeUncertain?: boolean;
  completedDestinations?: number[];
}

// ── API functions ──

export async function listPipelines(nameFilter?: string): Promise<PipelineSummary[]> {
  const params = nameFilter ? { name: nameFilter } : {};
  const { data } = await api.get('/api/pipelines', { params });
  return data;
}

export async function getPipeline(id: string): Promise<PipelineDefinition> {
  const { data } = await api.get(`/api/pipelines/${id}`);
  return data;
}

export async function savePipeline(id: string, content: PipelineContent, expectedRevisionId: string): Promise<PipelineDefinition> {
  return (await api.put(`/api/pipelines/${encodeURIComponent(id)}`, content, { headers: { 'If-Match': `"${expectedRevisionId}"` } })).data;
}

export async function createPipeline(id: string, content: PipelineContent): Promise<void> {
  await api.post(`/api/pipelines/${id}`, content);
}

export async function deletePipeline(id: string, expectedRevisionId: string): Promise<void> {
  await api.delete(`/api/pipelines/${encodeURIComponent(id)}`, { headers: { 'If-Match': `"${expectedRevisionId}"` } });
}

export async function getPipelineRevisions(id: string): Promise<PipelineRevision[]> {
  const { data } = await api.get(`/api/pipelines/${id}/revisions`);
  return data;
}

export async function validatePipeline(id: string, content?: PipelineContent): Promise<{ valid: boolean; errors: string[]; revisionId: string }> {
  const { data } = await api.post(`/api/pipelines/${encodeURIComponent(id)}/validate`, { content });
  return data;
}

export async function listExecutions(pipelineName?: string): Promise<ExecutionState[]> {
  const params = pipelineName ? { pipeline: pipelineName } : {};
  const { data } = await api.get('/api/executions', { params });
  return data;
}

export async function getExecution(id: string): Promise<ExecutionState> {
  const { data } = await api.get(`/api/executions/${id}`);
  return data;
}

export type TestMode = 'real' | 'mock';
export interface LocalTestOptions { testMode: TestMode; mocks?: unknown }
export interface InspectionDocument { available: boolean; value: unknown }
export interface ConnectorCall {
  connector?: string | null;
  operation?: string | null;
  requestMetadata?: Record<string, unknown> | null;
  responseMetadata?: Record<string, unknown> | null;
  step: string;
  kind: string;
  destinationIndex?: number | null;
  method?: string | null;
  url?: string | null;
  startedAt?: string | null;
  durationMs?: number | null;
  timeoutMs?: number | null;
  requestHeaders?: Record<string, string[]> | null;
  requestBody?: string | null;
  requestBodyBytes?: number | null;
  requestBodyTruncated?: boolean;
  responseHeaders?: Record<string, string[]> | null;
  responseBody?: string | null;
  responseBodyBytes?: number | null;
  responseBodyTruncated?: boolean;
  statusCode?: number | null;
  reasonPhrase?: string | null;
  httpVersion?: string | null;
  error?: string | null;
}

export async function resumeExecution(id: string, acknowledgeUncertain = false): Promise<{ executionId: string }> {
  return (await api.post(`/api/executions/${encodeURIComponent(id)}/resume`, { acknowledgeUncertain })).data;
}
export async function replayExecution(id: string, revisionId?: string, acknowledgeUncertain = false): Promise<{ executionId: string; replayOf: string }> {
  return (await api.post(`/api/executions/${encodeURIComponent(id)}/replay`, { revisionId, acknowledgeUncertain })).data;
}
export interface ExecutionInspection {
  execution: ExecutionState;
  pipeline: InspectionDocument;
  testContext: InspectionDocument;
  idm: InspectionDocument;
  sources: Record<string, InspectionDocument>;
  outputs: Record<string, InspectionDocument>;
}

export async function getExecutionInspection(id: string): Promise<ExecutionInspection> {
  return (await api.get(`/api/executions/${encodeURIComponent(id)}/inspection`)).data;
}

export async function getMockTemplate(pipelineId: string, content?: PipelineContent): Promise<{ revisionId: string; mocks: unknown }> {
  return (await api.post(`/api/pipelines/${encodeURIComponent(pipelineId)}/test-template`, { content })).data;
}

export interface TriggerResult {
  inspection?: ExecutionInspection;
  statusCode: number;
  body: string;
  durationMs: number;
  error?: string;
  warnings?: string[];
  revisionId?: string;
}

export async function triggerViaEndpoint(
  endpoint: string,
  payload: string,
  authUser?: string,
  authPassword?: string,
): Promise<TriggerResult> {
  const start = performance.now();
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authUser && authPassword) {
      headers['Authorization'] = 'Basic ' + btoa(`${authUser}:${authPassword}`);
    }
    const response = await fetch(`${API_BASE}/api/v1/trigger${endpoint}`, {
      method: 'POST',
      headers,
      body: payload,
    });
    const body = await response.text();
    return {
      statusCode: response.status,
      revisionId: response.headers.get('x-elwood-revision') ?? undefined,
      body,
      durationMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    return {
      statusCode: 0,
      body: '',
      durationMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : 'Request failed',
    };
  }
}

export async function executePipeline(pipelineId: string, payload: string, options: LocalTestOptions, content?: PipelineContent, expectedRevisionId?: string): Promise<TriggerResult> {
  const start = performance.now();
  try {
    if (!options || !['real', 'mock'].includes(options.testMode)) throw new Error('Choose real systems or mocks before running.');
    if (options.testMode === 'mock' && !options.mocks) throw new Error('Mock fixtures are required.');
    if (options.testMode === 'real' && options.mocks !== undefined) throw new Error('Real-system tests cannot include mocks.');
    const { data, status } = await api.post('/api/executions', {
      pipelineId,
      payload: JSON.parse(payload),
      testMode: options.testMode, mocks: options.mocks, content, expectedRevisionId,
    });
    return {
      statusCode: status,
      body: JSON.stringify(data, null, 2),
      durationMs: Math.round(performance.now() - start),
      error: executionError(data),
      revisionId: data.revisionId,
      inspection: data.inspection,
    };
  } catch (err) {
    return {
      statusCode: axios.isAxiosError(err) ? err.response?.status ?? 0 : 0,
      body: JSON.stringify(axios.isAxiosError(err) ? err.response?.data : null, null, 2),
      durationMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : 'Execution request failed.',
    };
  }
}

export async function testScript(pipelineId: string, name: string, payload: string, expectedRevisionId?: string): Promise<TriggerResult> {
  const start = performance.now();
  try {
    const response = await api.post(`/api/pipelines/${encodeURIComponent(pipelineId)}/scripts/${encodeURIComponent(name)}/test`,
      JSON.parse(payload), { validateStatus: () => true, headers: expectedRevisionId ? { 'If-Match': `"${expectedRevisionId}"` } : {} });
    return {
      statusCode: response.status,
      body: JSON.stringify(response.data, null, 2),
      durationMs: Math.round(performance.now() - start),
      warnings: readWarnings(response.headers['x-elwood-warnings']),
      revisionId: response.headers['x-elwood-revision'],
      error: response.status >= 400 ? response.data?.errors?.join('\n') || response.data?.error || 'Script test failed.' : undefined,
    };
  } catch (error) {
    return { statusCode: 0, body: '', durationMs: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : 'Script test failed.' };
  }
}

export async function getHealth(): Promise<{ status: string; timestamp: string }> {
  const { data } = await api.get('/api/health');
  return data;
}

export async function deployPipeline(id: string, expectedRevisionId: string): Promise<PipelineDefinition> {
  return (await api.post(`/api/pipelines/${encodeURIComponent(id)}/deploy`, { expectedRevisionId })).data;
}
export async function migratePipeline(id: string, expectedRevisionId: string): Promise<PipelineDefinition> {
  return (await api.post(`/api/pipelines/${encodeURIComponent(id)}/migrate`, { expectedRevisionId })).data;
}
