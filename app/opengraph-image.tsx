import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Collabr — Brand–creator collaborations you can trust'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Branded share card for the landing page (WhatsApp / LinkedIn / X previews).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0A0C22 0%, #0A0C22 55%, #1B1D4D 100%)',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, letterSpacing: '-3px' }}>
          collabr<span style={{ color: '#7C6CFF' }}>.</span>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: '-1px',
            marginTop: 28,
            textAlign: 'center',
          }}
        >
          Collaborations you can trust.
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 24,
            color: 'rgba(255,255,255,.6)',
            marginTop: 18,
            textAlign: 'center',
          }}
        >
          Protected payments · Structured approvals · Real reputation
        </div>
      </div>
    ),
    size
  )
}
