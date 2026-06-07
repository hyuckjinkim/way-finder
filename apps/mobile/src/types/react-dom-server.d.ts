/**
 * `react-dom/server` 최소 앰비언트 선언 (E3 라우트 렌더 테스트 전용).
 *
 * @types/react-dom는 미설치(의존성 추가 금지)이고 react-dom은 자체 타입을 동봉하지 않는다.
 * routeRender.test.tsx가 renderToStaticMarkup만 사용하므로 그 시그니처만 선언한다.
 */
declare module 'react-dom/server' {
  import type { ReactElement } from 'react';
  export function renderToStaticMarkup(element: ReactElement): string;
}
