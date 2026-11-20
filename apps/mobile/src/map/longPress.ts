/**
 * 지도 길게 누르기 (F6, 웹 전용) — 카카오·MapLibre 웹 모두 네이티브 longpress 이벤트가 없어 합성한다.
 * 손가락 하나로 LONG_PRESS_MS 동안 거의 안 움직이면 컨테이너 기준 픽셀(x, y)로 onFire.
 * 움직임(슬롭 초과)·두 손가락(핀치)·손 뗌·cancel()(지도 드래그·줌 시작)이면 취소.
 */
export const LONG_PRESS_MS = 500;
const SLOP_PX = 10;
/** 같은 제스처에 브라우저 contextmenu(안드로이드 길게 누르기)와 타이머가 둘 다 오면 한 번만. */
export const LONG_PRESS_DEDUPE_MS = 800;

type TouchLike = { clientX: number; clientY: number };
type TouchEventLike = Event & { touches: ArrayLike<TouchLike> };

export interface LongPressHandle {
  cancel(): void;
  detach(): void;
}

export function attachLongPress(el: HTMLElement, onFire: (x: number, y: number) => void): LongPressHandle {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let start: TouchLike | null = null;

  const cancel = (): void => {
    clearTimeout(timer);
    timer = undefined;
    start = null;
  };
  const onStart = (e: Event): void => {
    cancel();
    const { touches } = e as TouchEventLike;
    if (touches.length !== 1) return;
    const s = { clientX: touches[0]!.clientX, clientY: touches[0]!.clientY };
    start = s;
    timer = setTimeout(() => {
      cancel();
      const r = el.getBoundingClientRect();
      onFire(s.clientX - r.left, s.clientY - r.top);
    }, LONG_PRESS_MS);
  };
  const onMove = (e: Event): void => {
    const t = (e as TouchEventLike).touches[0];
    if (!start || !t || Math.hypot(t.clientX - start.clientX, t.clientY - start.clientY) > SLOP_PX) cancel();
  };

  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchmove', onMove, { passive: true });
  el.addEventListener('touchend', cancel);
  el.addEventListener('touchcancel', cancel);
  return {
    cancel,
    detach() {
      cancel();
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', cancel);
      el.removeEventListener('touchcancel', cancel);
    },
  };
}

/** cb를 LONG_PRESS_DEDUPE_MS 안에 한 번만 부르는 래퍼(우클릭/contextmenu와 터치 타이머 중복 방지). */
export function dedupeLongPress<T>(cb: (v: T) => void): (v: T) => void {
  let last = -Infinity;
  return (v) => {
    const now = Date.now();
    if (now - last < LONG_PRESS_DEDUPE_MS) return;
    last = now;
    cb(v);
  };
}
