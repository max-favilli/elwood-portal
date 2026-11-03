import { api, type InspectionDocument, type StepAttempt, type StepDiagnostic } from "./api";

export interface WorkStage {
  stageId: string; stepName: string; stepType: string; generation: string; revisionId: string;
  status: string; itemCount: number; aggregatedItems: number; deadline: string; expiresAt: string;
  recoveryIssue?: string; admitted: boolean;
}
export interface WorkItem {
  ordinal: number; status: string; attempt: number; version: number; uncertain: boolean;
  diagnostic?: string; notBefore?: string; canRetry: boolean;
}
export interface WorkPage { generation: string; observedAt: string; scanned: number; items: WorkItem[]; nextCursor?: string; }
export interface WorkDetail {
  item: WorkItem; revisionId: string; generation: string; attemptCount: number; attempts: StepAttempt[];
  nextAttemptCursor?: string; diagnostics: StepDiagnostic[]; completedDestinations: number[];
  historyOmitted?: boolean;
  omittedCallAttempts?: number[];
  diagnosticsOmitted?: boolean;
}
export interface WorkInspection { attempt: number; input: InspectionDocument; output: InspectionDocument; receipts: Record<number, InspectionDocument>; }
export interface RetryRequest { requestId: string; generation: string; items: { ordinal: number; expectedAttempt: number; acknowledgeUncertain: boolean }[]; }
export interface RetryResult { requestId: string; generation: string; revisionId: string; items: { ordinal: number; expectedAttempt: number; status: string; reason?: string }[]; }
const root = (id: string, stage?: string) => `/api/executions/${encodeURIComponent(id)}/work-stages${stage ? `/${encodeURIComponent(stage)}` : ""}`;
export const getWorkStages = async (id: string): Promise<WorkStage[]> => (await api.get(root(id))).data;
export const getWorkItems = async (id: string, stage: string, status?: string, cursor?: string): Promise<WorkPage> =>
  (await api.get(`${root(id, stage)}/items`, { params: { status: status || undefined, cursor, limit: 50 } })).data;
export const getWorkItem = async (id: string, stage: string, ordinal: number, attemptCursor?: string): Promise<WorkDetail> =>
  (await api.get(`${root(id, stage)}/items/${ordinal}`, { params: { attemptCursor } })).data;
export const inspectWorkItem = async (id: string, stage: string, ordinal: number, attempt?: number): Promise<WorkInspection> =>
  (await api.get(`${root(id, stage)}/items/${ordinal}/inspection`, { params: { attempt } })).data;
export const retryWorkItems = async (id: string, stage: string, request: RetryRequest): Promise<RetryResult> =>
  (await api.post(`${root(id, stage)}/retry`, request)).data;
