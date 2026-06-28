/**
 * 지도 구현 에러 바운더리 — Kakao 네이티브 실패 시 폴백으로 degrade.
 *
 * 배경: `@react-native-kakao/map` 2.2.7은 모노레포에서 RN 0.77 안드로이드 빌드 깨짐을 이유로
 * 제거된 terminal 버전(업그레이드 경로 없음)인데, 이 앱은 RN 0.85.3을 쓴다. 코드젠/Fabric
 * 내부 API churn(0.74→0.85)으로 디바이스에서 Kakao 네이티브 지도가 throw할 리스크가 있다.
 * 이 바운더리는 자식(Kakao)이 렌더/lifecycle 중 throw하면 crash 대신 fallback(MapLibre,
 * 무키·한국 커버·동일 MapViewProps/Ref 계약)으로 전환한다.
 *
 * 주의: React 에러 바운더리는 클래스 컴포넌트로만 구현 가능하다(함수형 불가) — 프로젝트의
 * "함수형 컴포넌트만" 규칙의 불가피한 예외이며 이 파일 한 곳에 국한한다. throw 없이 빈 화면만
 * 뜨는(silent blank) 경우는 바운더리가 잡지 못하므로, 디바이스 QA(RELEASE-CHECKLIST §2)로
 * Kakao 네이티브 실제 렌더를 별도 확인해야 한다.
 */
import { Component, type ReactNode } from 'react';

interface Props {
  /** 자식이 throw하면 대신 렌더할 폴백(MapLibre 구현). */
  fallback: ReactNode;
  children: ReactNode;
  /** 폴백 전환 시 호출(관측/로깅용, 선택). */
  onFallback?: (error: Error) => void;
}

interface State {
  failed: boolean;
}

export class MapErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error): void {
    this.props.onFallback?.(error);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
