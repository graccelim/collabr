-- 033: restrict dispute-evidence uploads to safe media types.
--
-- The bucket previously allowed any MIME type. Evidence is later handed to the
-- counterparty + mediator via a signed URL from the storage domain; an HTML/SVG
-- file would render inline there → stored-XSS / phishing. Limit to images / pdf
-- / video (no text/html, no image/svg+xml). The route also validates server-side.
update storage.buckets
set allowed_mime_types = array[
  'image/png','image/jpeg','image/webp','image/gif',
  'application/pdf','video/mp4','video/quicktime'
]
where id = 'dispute-evidence';
