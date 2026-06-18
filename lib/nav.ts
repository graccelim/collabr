/**
 * Sanitize a `?next=` redirect target. Only same-origin absolute paths are
 * allowed - anything else (absolute URL, protocol-relative "//evil.com",
 * backslash tricks) falls back, so the post-auth redirect can't be hijacked
 * into an open redirect.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw) return fallback
  if (!raw.startsWith('/')) return fallback
  // Block protocol-relative and backslash-escaped origins.
  if (raw.startsWith('//') || raw.startsWith('/\\') || raw.startsWith('/%2F') || raw.startsWith('/%5C')) return fallback
  return raw
}
