import { describe, expect, it } from 'vitest';
import { canRedraw, redrawErrorText, redrawUnknownText } from '../src/redraw';

describe('кнопка «Разыграть заново»', () => {
  it('для невостребованного приза доступна', () => {
    expect(canRedraw({ status: 'unclaimed' })).toBe(true);
  });

  it('для подтверждённого приза и приза в пределах срока недоступна', () => {
    expect(canRedraw({ status: 'confirmed' })).toBe(false);
    expect(canRedraw({ status: 'pending' })).toBe(false);
  });
});

describe('сообщение об ошибке повтора', () => {
  it('называет причину и говорит, что приз не изменился', () => {
    const text = redrawErrorText('нет кандидатов для повтора');
    expect(text).toContain('нет кандидатов для повтора');
    expect(text).toContain('остался у прежнего победителя');
  });

  it('не показывает коды правил', () => {
    expect(redrawErrorText('R6: срок подтверждения не истёк (ADR-3)')).not.toMatch(/R\d|ADR/);
  });

  it('без причины всё равно понятно', () => {
    expect(redrawErrorText('')).toMatch(/^Не удалось разыграть приз заново\. /);
  });
});

describe('сообщение, когда ответ не получен', () => {
  it('не обещает, что приз не изменился, и просит обновить данные', () => {
    const text = redrawUnknownText();
    expect(text).not.toContain('остался у прежнего победителя');
    expect(text).toContain('Обновите страницу');
  });
});
