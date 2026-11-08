export interface PracticeShortcuts {
  toggle: () => void
  tempo: (delta: number) => void
  transpose: (delta: number) => void
  clearLoop: () => void
}

// Run the practice action of a key press, unless the user is typing or editing
export function handlePracticeShortcut(event: KeyboardEvent, editing: boolean, actions: PracticeShortcuts) {
  const target = event.target as HTMLElement | null
  if (
    editing ||
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    target?.closest?.('input, select, textarea, button, [role="button"], [contenteditable]:not([contenteditable="false"])')
  ) return

  // Leave all other keys and browser shortcuts to their normal handlers.
  switch (event.code) {
    case 'Space':
      event.preventDefault()
      actions.toggle()
      break
    case 'ArrowUp':
      event.preventDefault()
      actions.tempo(5)
      break
    case 'ArrowDown':
      event.preventDefault()
      actions.tempo(-5)
      break
    case 'ArrowRight':
      event.preventDefault()
      actions.transpose(1)
      break
    case 'ArrowLeft':
      event.preventDefault()
      actions.transpose(-1)
      break
    case 'KeyL':
      event.preventDefault()
      actions.clearLoop()
      break
  }
}
