/**
 * 장소 공유(F2) — 웹 공유 시트(navigator.share)가 있으면 그것, 없거나 실패하면 링크 복사.
 *
 * ponytail: 카카오톡 공유(Kakao.Share.sendDefault)는 JS 키·도메인 등록이 필요해 보류.
 * 카카오톡 인앱 브라우저의 navigator.share 동작은 미확인이라 복사 폴백은 빼지 않는다.
 */
import type { LatLng } from '@wayfinder/shared';
import { placeHref } from '../search/placeUrl';
import { copyText } from '../search/placeActions';

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

type ShareNav = { share?: Navigator['share']; clipboard?: Pick<Clipboard, 'writeText'> };

const currentNav = (): ShareNav | undefined => (typeof navigator === 'undefined' ? undefined : navigator);

/** 링크는 항상 placeHref(이름·좌표 힌트 포함) — 힌트 없는 google: 링크는 404다. */
export function buildPlaceShare(
  place: { id: string; name: string; coord: LatLng; address?: string },
  origin: string,
): SharePayload {
  return {
    title: place.name,
    text: place.address ? `${place.name} · ${place.address}` : place.name,
    url: `${origin}${placeHref(place)}`,
  };
}

export function canShare(nav: ShareNav | undefined = currentNav()): boolean {
  return typeof nav?.share === 'function' || typeof nav?.clipboard?.writeText === 'function';
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * 클릭 핸들러에서 바로 호출할 것 — navigator.share는 사용자 제스처 안에서만 열린다(앞에 await 금지).
 * 사용자가 공유 시트를 닫으면(AbortError) 복사로 넘어가지 않는다.
 */
export async function sharePlace(payload: SharePayload, nav: ShareNav | undefined = currentNav()): Promise<ShareResult> {
  if (typeof nav?.share === 'function') {
    try {
      await nav.share(payload);
      return 'shared';
    } catch (e) {
      if ((e as { name?: string } | null)?.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(payload.url, nav as Pick<Navigator, 'clipboard'> | undefined)) ? 'copied' : 'failed';
}
