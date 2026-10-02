import { describe, expect, it } from 'vitest';
import { LEARNING_GOAL_CONFIG, buildDailyPlanGoalExplanation, getGoalModuleBonus } from '@/lib/learning-goals';

describe('learning-goals', () => {
  it('returns a stronger speaking bonus for travel than for read', () => {
    expect(getGoalModuleBonus('travel', 'speak')).toBeGreaterThan(getGoalModuleBonus('travel', 'read'));
  });

  it('builds a goal explanation from the active goal', () => {
    const explanation = buildDailyPlanGoalExplanation('travel');

    expect(explanation).toContain('Travel');
  });

  it('exposes the supported learning goals', () => {
    expect(Object.keys(LEARNING_GOAL_CONFIG)).toEqual(['speaking', 'exam', 'travel', 'work', 'balanced']);
  });
});
