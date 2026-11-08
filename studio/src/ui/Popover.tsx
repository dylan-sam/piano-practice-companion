import { useEffect, useRef, useState, type ReactNode } from 'react'

interface PopoverProps {
  id: string
  label: ReactNode
  title?: string
  active?: boolean // shows a dot on the button when a setting is on
  className?: string
  children: (close: () => void) => ReactNode
}

// A button with a panel that pops up above it; closes on outside click or Escape
export function Popover({ id, label, title, active, className, children }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    // Close when a click lands outside
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    // Close on Escape
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`popover ${className ?? ''}`}>
      <button
        className={active ? 'band-toggle band-toggle-active' : 'band-toggle'}
        aria-expanded={open}
        aria-controls={id}
        title={title}
        onClick={() => setOpen(!open)}
      >
        {label}
      </button>
      {open && (
        <section id={id} className="popover-panel">
          {children(() => setOpen(false))}
        </section>
      )}
    </div>
  )
}
