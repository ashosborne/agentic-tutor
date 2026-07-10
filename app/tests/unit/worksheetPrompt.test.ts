import { describe, expect, it } from 'vitest';
import type { Child, Topic } from '../../shared/types.js';
import {
  buildWorksheetPrompt,
  deriveWorksheetTitle,
} from '../../server/src/agents/worksheetPrompt.js';

const child: Child = {
  id: 'c',
  name: 'Maya',
  dateOfBirth: '2021-01-01',
  age: 5,
  yearGroup: 'Reception',
  interests: [],
  avatarColor: '#000',
  createdAt: '',
  updatedAt: '',
};

const topic: Topic = {
  id: 'mt_1',
  type: 'PROCEDURAL',
  subject: 'Mathematics',
  domain: 'Addition',
  name: 'Adding',
  description: 'Add numbers',
  ageRangeStart: 5,
  ageRangeEnd: 6,
  centrality: 0.1,
  evidence: ['1+1'],
  assessmentPrompt: 'Can {{name}} add?',
  standards: ['uk'],
};

describe('worksheetPrompt', () => {
  it('substitutes theme and topic into the docs template', () => {
    const prompt = buildWorksheetPrompt({
      child,
      theme: 'dinosaurs',
      topics: [topic],
      durationMinutes: 15,
    });

    expect(prompt).toContain('themed around dinosaurs');
    expect(prompt).not.toContain('themed around the ocean');
    expect(prompt).toContain('mt_1');
    expect(prompt).toContain('Can Maya add?');
    expect(prompt).toContain('Checklist for designers and teachers');
    expect(prompt).toContain('Name: Maya');
    expect(prompt).toContain('Age: 5');
  });

  it('uses plural copy for multiple topics', () => {
    const second: Topic = { ...topic, id: 'mt_2', name: 'Subtracting' };
    const prompt = buildWorksheetPrompt({
      child,
      theme: 'space',
      topics: [topic, second],
      durationMinutes: 20,
    });
    expect(prompt).toContain('learning points');
    expect(prompt).toContain('mt_2');
  });

  it('derives a readable title', () => {
    expect(deriveWorksheetTitle('dinosaurs', [topic])).toBe('dinosaurs — Adding');
  });
});
