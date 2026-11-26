// The name and icon of each part of a session (a step's kind), on the Lessons tab and a step's page.

import type { IconName } from '../ui/Icon'
import type { StepKind } from './program'

export const KIND_LABELS: Record<StepKind, string> = {
  hands: 'Hands together', listen: 'Listen', song: 'The song', improvise: 'Improvise', ear: 'Ear', check: 'Self-check',
}

export const KIND_ICONS: Record<StepKind, IconName> = {
  hands: 'hands', listen: 'listen', song: 'song', improvise: 'improvise', ear: 'ear', check: 'checklist',
}
