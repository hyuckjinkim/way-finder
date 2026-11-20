import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { attachLongPress, dedupeLongPress, LONG_PRESS_MS } from './longPress.js';

function fakeEl() {
  const target = new EventTarget();
  const el = Object.assign(target, { getBoundingClientRect: () => ({ left: 10, top: 20 }) });
  const touch = (type: string, pts: Array<[number, number]>) =>
    el.dispatchEvent(Object.assign(new Event(type), { touches: pts.map(([clientX, clientY]) => ({ clientX, clientY })) }));
  return { el: el as unknown as HTMLElement, touch };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('attachLongPress', () => {
  it('한 손가락으로 500ms 머물면 컨테이너 기준 좌표로 발화', () => {
    const { el, touch } = fakeEl();
    const fire = vi.fn();
    attachLongPress(el, fire);
    touch('touchstart', [[110, 220]]);
    touch('touchmove', [[113, 222]]); // 슬롭 안
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(fire).toHaveBeenCalledWith(100, 200);
  });

  it.each([
    ['드래그', (t: ReturnType<typeof fakeEl>['touch']) => t('touchmove', [[150, 220]])],
    ['손 뗌', (t: ReturnType<typeof fakeEl>['touch']) => t('touchend', [])],
    ['핀치', (t: ReturnType<typeof fakeEl>['touch']) => t('touchstart', [[110, 220], [200, 300]])],
  ])('%s이면 취소', (_, act) => {
    const { el, touch } = fakeEl();
    const fire = vi.fn();
    attachLongPress(el, fire);
    touch('touchstart', [[110, 220]]);
    act(touch);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(fire).not.toHaveBeenCalled();
  });

  it('cancel()(지도 드래그·줌 시작)과 detach 후엔 발화 안 함', () => {
    const { el, touch } = fakeEl();
    const fire = vi.fn();
    const h = attachLongPress(el, fire);
    touch('touchstart', [[110, 220]]);
    h.cancel();
    vi.advanceTimersByTime(LONG_PRESS_MS);
    h.detach();
    touch('touchstart', [[110, 220]]);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(fire).not.toHaveBeenCalled();
  });
});

describe('dedupeLongPress', () => {
  it('같은 제스처의 우클릭+타이머는 한 번만', () => {
    const cb = vi.fn();
    const f = dedupeLongPress(cb);
    f(1);
    f(2);
    vi.advanceTimersByTime(1000);
    f(3);
    expect(cb.mock.calls).toEqual([[1], [3]]);
  });
});
