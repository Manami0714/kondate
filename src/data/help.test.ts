import { describe, expect, it } from 'vitest';
import { FAQ, HELP_ORDER, SCREEN_HELP } from './help';

describe('ヘルプの文', () => {
  it('どの画面にも、ひとこと説明とできることがある', () => {
    for (const help of Object.values(SCREEN_HELP)) {
      expect(help.title).not.toBe('');
      expect(help.summary).not.toBe('');
      expect(help.points.length).toBeGreaterThan(0);
      for (const point of help.points) expect(point.trim()).not.toBe('');
    }
  });

  it('「使い方」の並びに、すべての画面が1回ずつ入っている', () => {
    expect([...HELP_ORDER].sort()).toEqual(Object.keys(SCREEN_HELP).sort());
  });

  it('よくある質問は、質問と答えが空でない', () => {
    for (const f of FAQ) {
      expect(f.question.trim()).not.toBe('');
      expect(f.answer.trim()).not.toBe('');
    }
  });
});
