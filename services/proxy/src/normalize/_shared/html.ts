/** 블로그 검색 응답(카카오·네이버)의 <b> 강조 태그 제거 + HTML 엔티티 디코드. */

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  middot: '·', hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

/**
 * 태그를 먼저 지우고 엔티티를 한 번의 패스로 디코드한다 — 연쇄 replace는 `&amp;lt;`를 `<`로 이중 디코드한다.
 * 모르는 이름·범위 밖 코드포인트는 원문 유지.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, ent: string) => {
      if (ent[0] !== '#') return NAMED[ent.toLowerCase()] ?? m;
      const cp = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    })
    .trim();
}
