// Phase 11 - contact-info detection for collab chat.
//
// collabr's escrow only protects deals that stay on-platform, so we flag (not
// block) messages that look like an attempt to move the conversation off the
// app: phone numbers, emails, @handles, or named messaging apps. Flagged
// messages still send (context matters for disputes) but enter the admin
// review queue and the sender is warned.

export interface ModerationResult {
  flagged: boolean
  reasons: string[]
}

// Named off-platform channels people use to take deals elsewhere.
const OFF_PLATFORM = /\b(whats[\s.]?app|wa\.me|telegram|t\.me|wechat|we[\s.]?chat|signal|viber|\bline\s?id\b|kakao|messenger|snapchat|snap\b)\b/i

// "dm me", "message me on", "my number is", "reach me at", "contact me" …
const SOLICIT = /\b(dm\s?me|message\s+me\s+on|text\s+me|reach\s+me\s+(at|on)|my\s+(number|email|handle)\s+is|add\s+me\s+on|contact\s+me\s+(at|on)|find\s+me\s+on)\b/i

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

// Singapore mobiles (+65 8xxx xxxx / 9xxx xxxx) and any long run of digits
// that reads like a phone number (7+ digits, allowing spaces/dashes).
const SG_PHONE = /(?:\+?65[\s-]?)?[89]\d{3}[\s-]?\d{4}\b/
const LONG_DIGITS = /(?:\d[\s-]?){8,}\d/

// A bare @handle (>= 3 chars) - but not an email (handled above).
const HANDLE = /(?:^|[^\w@])@[a-z0-9._]{3,}/i

export function detectContactInfo(text: string): ModerationResult {
  const reasons: string[] = []
  // Strip emails first so their "@" / digits don't double-trip other rules.
  const withoutEmail = text.replace(EMAIL, ' ')

  if (EMAIL.test(text)) reasons.push('email address')
  if (SG_PHONE.test(withoutEmail) || LONG_DIGITS.test(withoutEmail)) reasons.push('phone number')
  if (OFF_PLATFORM.test(text)) reasons.push('off-platform app')
  if (SOLICIT.test(text)) reasons.push('contact solicitation')
  if (HANDLE.test(withoutEmail)) reasons.push('social handle')

  return { flagged: reasons.length > 0, reasons: Array.from(new Set(reasons)) }
}
