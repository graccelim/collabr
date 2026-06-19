'use client'
import { useState } from 'react'
import InviteCreatorForm from './InviteCreatorForm'
import SaveCreatorButton from './SaveCreatorButton'
import ShareProfileButton from './ShareProfileButton'

type CampaignOption = { id: string; title: string; comp_type: string | null }

/**
 * Pro-brand action row on a creator profile: Invite + Save + Share. The
 * invite-open state lives here (not CSS :has) so Save/Share hide/show
 * SYNCHRONOUSLY when the invite form opens/closes — instant, no flicker — and
 * the open form spans the full width.
 */
export default function BrandCreatorActions({
  inviteProps, saveProps, shareProps,
}: {
  inviteProps: { creatorId: string; creatorName: string; campaigns: CampaignOption[]; pendingCampaignIds: string[] }
  saveProps: { creatorId: string; initialSaved: boolean }
  shareProps: { path: string; name: string }
}) {
  const [inviteOpen, setInviteOpen] = useState(false)
  return (
    <div className="bc-actions" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
      <InviteCreatorForm {...inviteProps} onOpenChange={setInviteOpen} />
      {!inviteOpen && <SaveCreatorButton {...saveProps} />}
      {!inviteOpen && (
        <span style={{ display: 'inline-flex' }}>
          <ShareProfileButton {...shareProps} />
        </span>
      )}
    </div>
  )
}
