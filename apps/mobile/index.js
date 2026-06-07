/**
 * Classic Expo 엔트리 (E1).
 *
 * E1은 expo-router를 의존성으로 설치만 하고 라우터 셸은 E2에서 배선한다.
 * 라우트(app/ 디렉토리)가 없는 상태에서 `expo-router/entry`를 쓰면 export가
 * "no routes found"로 실패하므로, E1은 registerRootComponent로 App을 직접 등록한다.
 * E2가 라우터 도입 시 main을 `expo-router/entry`로 전환한다.
 */
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
