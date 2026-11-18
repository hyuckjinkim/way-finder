import { describe, it, expect } from 'vitest';
import { installWebFocusStyle, WEB_FOCUS_CSS } from './webFocus';

function fakeDoc() {
  const nodes = new Map<string, { id: string; textContent: string }>();
  return {
    nodes,
    getElementById: (id: string) => nodes.get(id) ?? null,
    createElement: () => ({ id: '', textContent: '' }),
    head: { appendChild: (n: { id: string; textContent: string }) => void nodes.set(n.id, n) },
  } as unknown as Document & { nodes: typeof nodes };
}

describe('installWebFocusStyle', () => {
  it('기본 outline을 끄고 브랜드 테두리를 주입하며 한 번만 넣는다', () => {
    const doc = fakeDoc();
    installWebFocusStyle(doc);
    installWebFocusStyle(doc);
    expect(doc.nodes.size).toBe(1);
    expect([...doc.nodes.values()][0]!.textContent).toBe(WEB_FOCUS_CSS);
    expect(WEB_FOCUS_CSS).toContain('outline:none');
  });
  it('document가 없으면(네이티브·SSR) 조용히 무시', () => {
    expect(() => installWebFocusStyle(undefined)).not.toThrow();
  });
});
