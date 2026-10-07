import type { ElwoodDiagnostic } from '@elwood-lang/core';

export function isScript(source: string): boolean {
  // Skip only leading whitespace/comments, then inspect the first keyword.
  const leading = source.replace(/^(?:\s+|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, '');
  return /^(let|return)\b/.test(leading);
}

export function formatDiagnostic(diagnostic: ElwoodDiagnostic): string {
  const location = diagnostic.line != null ? `Line ${diagnostic.line}:${diagnostic.column ?? 1} — ` : '';
  return `${location}${diagnostic.message}${diagnostic.suggestion ? ` ${diagnostic.suggestion}` : ''}`;
}

export function evaluationWarnings(diagnostics: ElwoodDiagnostic[]): string[] {
  return diagnostics.filter(d => d.severity === 'warning').map(formatDiagnostic);
}

export function readWarnings(header: unknown): string[] {
  if (typeof header !== 'string' || !header) return [];
  try {
    const value: unknown = JSON.parse(header);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return ['The server returned an unreadable warnings header.'];
  }
}

export function executionError(data: { success?: boolean; errors?: string[] }): string | undefined {
  return data.success === false ? data.errors?.join('\n') || 'Pipeline execution failed.' : undefined;
}
