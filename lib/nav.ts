/**
 * Sanitize a `?next=` redirect target. Only same-origin absolute paths are
 * allowed - anything else (absolute URL, protocol-relative "//evil.com",
 * backslash tricks, control-char prefixes, encoded slashes) falls back, so the
 * post-auth redirect can't be hijacked into an open redirect.
 *
 * We validate by PARSING (not string-prefix matching): the WHATWG URL parser
 * strips leading C0 control chars (tab/CR/LF), so "/<tab>//evil.com" would
 * resolve to https://evil.com despite starting with "/". Resolving against a
 * throwaway origin and rejecting anything that doesn't stay on that origin
 * closes every such bypass; we return only the path+query+hash.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw) return fallback
  // Reject C0 control chars (incl. leading tab/CR/LF the URL parser would strip)
  // and backslashes (the parser treats "\" as "/").
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i)
    if (c < 0x20 || c === 0x5c /* \ */) return fallback
  }
  if (!raw.startsWith('/')) return fallback
  // Protocol-relative ("//host") + encoded slash/backslash variants (case-insensitive).
  if (raw.startsWith('//')) return fallback
  const lower = raw.toLowerCase()
  if (lower.startsWith('/%2f') || lower.startsWith('/%5c')) return fallback
  try {
    const BASE = 'https://x.invalid'
    const u = new URL(raw, BASE)
    if (u.origin !== BASE) return fallback // resolved off-origin → reject
    const out = u.pathname + u.search + u.hash
    // Re-validate the NORMALIZED output: "/..//evil.com" stays same-origin here
    // but pathname normalizes to "//evil.com", a protocol-relative URL the
    // consumers ('new URL(out, origin)' / router.push) would resolve off-origin.
    if (!out.startsWith('/') || out.startsWith('//') || out.startsWith('/\\')) return fallback
    return out
  } catch {
    return fallback
  }
}
