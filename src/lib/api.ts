import axios from 'axios';

// The Elwood Runtime API base URL.
// In development: run `dotnet run` on Elwood.Runtime.Api (defaults to http://localhost:5000).
// In production: set NEXT_PUBLIC_API_URL environment variable.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ── Types ──

export interface PipelineSummary {
  id: string;
  name: string;
  description?: string;
  sourceCount: number;
  outputCount: number;
  lastModified: string;
}

export interface PipelineDefinition {
  id: string;
  content: PipelineContent;
  lastModified: string;
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
  status: 'Pending' | 'Running' | 'Completed' | 'Failed';
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  sources: Record<string, SourceStepState>;
  outputs: Record<string, OutputStepState>;
  errors: string[];
}

export interface SourceStepState {
  sourceName: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  errors: string[];
}

export interface OutputStepState {
  outputName: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  errors: string[];
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

export async function savePipeline(id: string, content: PipelineContent): Promise<void> {
  await api.put(`/api/pipelines/${id}`, content);
}

export async function createPipeline(id: string, content: PipelineContent): Promise<void> {
  await api.post(`/api/pipelines/${id}`, content);
}

export async function deletePipeline(id: string): Promise<void> {
  await api.delete(`/api/pipelines/${id}`);
}

export async function getPipelineRevisions(id: string): Promise<PipelineRevision[]> {
  const { data } = await api.get(`/api/pipelines/${id}/revisions`);
  return data;
}

export async function validatePipeline(id: string): Promise<{ valid: boolean; errors: string[] }> {
  const { data } = await api.post(`/api/pipelines/${id}/validate`);
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

export async function triggerExecution(pipelineId: string, input?: unknown): Promise<string> {
  const { data } = await api.post('/api/executions', { pipelineId, input });
  return data.executionId;
}

export async function getHealth(): Promise<{ status: string; timestamp: string }> {
  const { data } = await api.get('/api/health');
  return data;
}
