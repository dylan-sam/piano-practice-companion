import { describe, expect, test, vi } from 'vitest'
import { handlePracticeShortcut } from '../src/ui/shortcuts'

function keyEvent(code: string, patch: Partial<KeyboardEvent> = {}) {
  return {
    code,
    target: null,
    defaultPrevented: false,
    isComposing: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    ...patch,
  } as unknown as KeyboardEvent
}

function actions() {
  return { toggle: vi.fn(), tempo: vi.fn(), transpose: vi.fn(), clearLoop: vi.fn() }
}

describe('practice keyboard shortcuts', () => {
  test.each([
    ['Space', 'toggle', undefined],
    ['ArrowUp', 'tempo', 5],
    ['ArrowDown', 'tempo', -5],
    ['ArrowRight', 'transpose', 1],
    ['ArrowLeft', 'transpose', -1],
    ['KeyL', 'clearLoop', undefined],
  ] as const)('%s invokes only its practice action', (code, action, delta) => {
    const handlers = actions()
    const event = keyEvent(code)
    handlePracticeShortcut(event, false, handlers)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    for (const [name, handler] of Object.entries(handlers)) {
      expect(handler).toHaveBeenCalledTimes(name === action ? 1 : 0)
    }
    if (delta !== undefined) expect(handlers[action]).toHaveBeenCalledWith(delta)
  })

  test('unrelated keys keep their default behavior', () => {
    const handlers = actions()
    const event = keyEvent('KeyA')
    handlePracticeShortcut(event, false, handlers)
    expect(event.preventDefault).not.toHaveBeenCalled()
    for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled()
  })

  test.each(['Space', 'ArrowUp', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'KeyL'])(
    '%s is ignored while editing or focusing a control', (code) => {
      for (const editing of [false, true]) {
        const handlers = actions()
        const event = keyEvent(code, {
          target: editing ? null : { closest: () => ({}) } as unknown as HTMLElement,
        })
        handlePracticeShortcut(event, editing, handlers)
        expect(event.preventDefault).not.toHaveBeenCalled()
        for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled()
      }
    },
  )

  test.each(['altKey', 'ctrlKey', 'metaKey', 'isComposing', 'defaultPrevented'] as const)(
    '%s leaves handled or composing keys alone', (flag) => {
      for (const code of ['Space', 'ArrowUp', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'KeyL']) {
        const handlers = actions()
        const event = keyEvent(code, { [flag]: true })
        handlePracticeShortcut(event, false, handlers)
        expect(event.preventDefault).not.toHaveBeenCalled()
        for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled()
      }
    },
  )
})
