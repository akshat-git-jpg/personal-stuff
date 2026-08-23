import { useEffect } from 'react'

// The toggle rail sticks directly under the header, so it needs the header's
// height as its `top`. Hard-coding that number breaks the moment the header
// wraps to two lines on a narrow window - the rail then either overlaps it or
// floats below it with a gap. Measure it instead, and re-measure on resize.
export function useChromeOffset(): void {
  useEffect(() => {
    const apply = () => {
      const header = document.querySelector('.header')
      if (!header) return
      const h = Math.round(header.getBoundingClientRect().height)
      document.documentElement.style.setProperty('--chrome-top', h + 'px')
    }

    apply()

    const header = document.querySelector('.header')
    // ResizeObserver is absent in some test environments; the initial measure
    // and the resize listener still give a correct first paint without it.
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(apply) : null
    if (ro && header) ro.observe(header)
    window.addEventListener('resize', apply)

    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', apply)
    }
  }, [])
}
