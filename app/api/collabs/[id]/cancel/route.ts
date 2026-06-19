import { NextRequest, NextResponse } from 'next/server'

/**
 * Self-serve cancellation of an ACCEPTED collaboration is intentionally not
 * available. Once a brand accepts a creator, the collaboration is a real
 * agreement (products may be shipped, budget reserved, work started) for both
 * paid and barter collabs. If something goes wrong, parties use the
 * dispute/support flow instead.
 *
 * (Pre-acceptance reversal still exists separately: a creator can withdraw an
 * application, and a brand can "Undo selection" before escrow is funded.)
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Accepted collaborations can’t be cancelled here. Open a dispute or contact support if something’s wrong.' },
    { status: 403 },
  )
}
