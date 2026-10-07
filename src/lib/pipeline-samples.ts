import type { PipelineContent } from './api';

export interface PipelineSample {
  id: string;
  title: string;
  description: string;
  expectedOutcome: string;
  realNotes: string;
  content: PipelineContent;
  input: unknown;
  mocks: unknown;
}

export function sampleContent(sample: PipelineSample, pipelineId: string): PipelineContent {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(pipelineId)) throw new Error('Use a lowercase pipeline ID with letters, numbers and hyphens.');
  return {
    yaml: sample.content.yaml.replace(/^name: .+$/m, `name: ${pipelineId}`)
      .replace(`endpoint: /samples/${sample.id}`, `endpoint: /samples/${pipelineId}`),
    scripts: { ...sample.content.scripts },
  };
}

export function findPipelineSample(samples: PipelineSample[], content?: PipelineContent): PipelineSample | undefined {
  const id = content?.yaml.match(/^# sample: ([a-z0-9-]+)\s*$/m)?.[1];
  return samples.find(sample => sample.id === id);
}
