/**
 * 장소 시트 액션 — 전화 걸기·주소 복사·경로 입력으로 보내기.
 */
import type { LatLng } from '@wayfinder/shared';
import { routeQuery } from '../route/routeUrl';

/** "02-123-4567" → "tel:021234567". 숫자·선행 +만 남기고, 번호가 없으면 undefined. */
export function telUrl(phone: string): string | undefined {
  const cleaned = phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  return /\d/.test(cleaned) ? `tel:${cleaned}` : undefined;
}

/** 이 장소를 출발/도착으로 채운 경로 입력 URL. */
export function routeInputHref(role: 'origin' | 'destination', place: { name: string; coord: LatLng }): string {
  return `/route/input${routeQuery({ [role]: { label: place.name, coord: place.coord } })}`;
}

/** 클립보드 복사 가능 여부(웹 secure context). 네이티브엔 추가 의존성 없이 지원하지 않는다. */
export function canCopyText(nav: Pick<Navigator, 'clipboard'> | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  return typeof nav?.clipboard?.writeText === 'function';
}

export async function copyText(
  text: string,
  nav: Pick<Navigator, 'clipboard'> | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): Promise<boolean> {
  if (!canCopyText(nav)) return false;
  try {
    await nav!.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
