/**
 * 웹 입력창 포커스 스타일 — 브라우저 기본(주황/파랑 outline) 대신 브랜드색 안쪽 테두리.
 * RN-web은 TextInput의 outline을 스타일로 못 끄는 경우가 있어 문서에 규칙 하나를 주입한다.
 */
export const WEB_FOCUS_CSS =
  'input:focus,textarea:focus{outline:none !important;box-shadow:inset 0 0 0 2px #1a73e8}' +
  // 패널 루트(tabIndex -1)는 프로그램 포커스용 — 링을 그리지 않는다.
  '[data-testid="overlay-panel"]:focus{outline:none}';

const STYLE_ID = 'wayfinder-focus-style';

/** 웹에서만 동작, 중복 호출은 무시(document가 없으면 no-op). */
export function installWebFocusStyle(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): void {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = STYLE_ID;
  el.textContent = WEB_FOCUS_CSS;
  doc.head.appendChild(el);
}
