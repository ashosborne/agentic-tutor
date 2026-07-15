import type { AssessmentRecommendation } from './types.js';

/** Parent-facing labels for assessment recommendations (no teacher jargon). */
export function recommendationLabel(
  recommendation: AssessmentRecommendation | string,
): string {
  switch (recommendation) {
    case 'advance':
      return 'Ready to move on';
    case 'practice':
      return 'Keep practising';
    case 'refresh':
      return 'Needs a gentle refresh';
    default:
      return String(recommendation);
  }
}

export function recommendationHint(
  recommendation: AssessmentRecommendation | string,
): string {
  switch (recommendation) {
    case 'advance':
      return 'They showed solid understanding on this sheet.';
    case 'practice':
      return 'They’re getting there — a little more practice will help.';
    case 'refresh':
      return 'Something earlier may need a gentle revisit.';
    default:
      return '';
  }
}
