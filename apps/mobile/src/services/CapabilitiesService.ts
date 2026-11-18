/**
 * CapabilitiesService — 프록시가 지원하는 이동수단 조회 (GET /v1/capabilities).
 * 데모 모드는 mock 라우터가 전 모드를 지원하므로 전부 지원으로 응답한다.
 */
import { capabilitiesPath, type Capabilities } from '@wayfinder/shared/api';
import { apiFetch, isDemoMode } from './apiClient.js';

const ALL_MODES = ['walk', 'transit', 'car', 'bike'];
const DEMO_CAPABILITIES: Capabilities = {
  modes: { kr: ALL_MODES, global: ALL_MODES },
  walkPreferences: true,
};

export async function getCapabilities(): Promise<Capabilities> {
  if (isDemoMode) return DEMO_CAPABILITIES;
  return (await apiFetch(capabilitiesPath)) as Capabilities;
}
