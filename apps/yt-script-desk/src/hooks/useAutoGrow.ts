import { useLayoutEffect, type RefObject } from 'react'

// A textarea that is exactly as tall as its text.
//
// Every edit box in the desk opened at a fixed height and scrolled inside
// itself. Owner, 2026-08-29, on a five-paragraph conclusion: *"whenever I click
// on pencil button and edit it opens the small box and inside I have to go up
// and down to go to the text. Can we make the edit box dynamic to cover the
// entire text so that I can see the entire text in one go."*
//
// He is editing prose he has to read as a whole. A box showing two lines of it
// is a worse view of the text than the one he clicked out of.
//
// `height = auto` FIRST, then `scrollHeight`: without the reset the box can only
// ever grow, because the `scrollHeight` of an already-tall box is its own
// height, and deleting a paragraph would leave the empty space behind.
//
// `useLayoutEffect`, not `useEffect`, so the size is set before the browser
// paints. With `useEffect` the box appears at its default height and jumps.
export function useAutoGrow(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  active = true,
): void {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !active) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [ref, value, active])
}
