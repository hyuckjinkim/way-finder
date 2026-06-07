/**
 * Cloudflare Workers 프록시 진입점 — Foundation 플레이스홀더 (F4).
 *
 * `wrangler deploy --dry-run`이 빌드할 실제 main 엔트리를 제공한다. 키 0개로 동작.
 * 스트림 A(A2)가 이 파일을 Hono 앱 + 엔드포인트 4종으로 교체한다.
 */
export default {
  async fetch(): Promise<Response> {
    return new Response(
      JSON.stringify({ status: 'ok', service: 'wayfinder-proxy', phase: 1 }),
      { headers: { 'content-type': 'application/json' } },
    );
  },
};
