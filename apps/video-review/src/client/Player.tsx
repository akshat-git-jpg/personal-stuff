import { useEffect, useRef, useState, type RefObject } from 'react'
import { fmtTime } from '../shared/rules'
import type { Note } from '../shared/types'

export type Spot = { x: number; y: number }

type Props = {
  src: string
  duration: number
  aspect: number
  notes: Note[]
  videoRef: RefObject<HTMLVideoElement | null>
  selected: Note | null
  onSelect: (n: Note) => void
  /** Owner only: the spot of the note being written. */
  draftSpot: Spot | null
  onFrameClick?: (s: Spot) => void
}

export function Player({ src, duration, aspect, notes, videoRef, selected, onSelect, draftSpot, onFrameClick }: Props) {
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTime(0)
    setPlaying(false)
  }, [src])

  const toggle = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  const seekTo = (t: number) => {
    const v = videoRef.current
    if (v) v.currentTime = Math.max(0, Math.min(duration, t))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.code === 'ArrowLeft') seekTo((videoRef.current?.currentTime ?? 0) - 5)
      else if (e.code === 'ArrowRight') seekTo((videoRef.current?.currentTime ?? 0) + 5)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const barTime = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * duration
  }

  // Show the picked note's dot while the video sits near its time.
  const shown = selected && Math.abs(time - selected.t) < 1.5 ? selected : null

  return (
    <div className="player">
      <div
        ref={frame}
        className={`frame${onFrameClick ? ' can-pin' : ''}`}
        style={{ aspectRatio: String(aspect) }}
        onClick={(e) => {
          if (!onFrameClick) return toggle()
          const r = frame.current!.getBoundingClientRect()
          videoRef.current?.pause()
          onFrameClick({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
        }}
      >
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          playsInline
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => {
            setTime(e.currentTarget.currentTime)
          }}
          onSeeked={(e) => {
            setTime(e.currentTarget.currentTime)
          }}
        />
        {shown && <Dot spot={shown} kind="note" />}
        {draftSpot && <Dot spot={draftSpot} kind="draft" />}
      </div>

      <div className="controls">
        <button className="btn icon" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="mono time" data-testid="time">
          {fmtTime(time, true)} / {fmtTime(duration)}
        </span>
        <div
          ref={bar}
          className="bar"
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          tabIndex={0}
          onPointerDown={(e) => {
            bar.current!.setPointerCapture(e.pointerId)
            seekTo(barTime(e.clientX))
          }}
          onPointerMove={(e) => {
            setHover(barTime(e.clientX))
            if (e.buttons === 1) seekTo(barTime(e.clientX))
          }}
          onPointerLeave={() => setHover(null)}
        >
          <div className="bar-fill" style={{ width: `${(time / duration) * 100}%` }} />
          {notes.map((n) => (
            <button
              key={n.id}
              className={`tick${selected?.id === n.id ? ' on' : ''}`}
              style={{ left: `${(n.t / duration) * 100}%` }}
              title={`${fmtTime(n.t)} ${n.text}`}
              aria-label={`Note at ${fmtTime(n.t)}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onSelect(n)}
            />
          ))}
          {hover !== null && (
            <span className="bar-hover mono" style={{ left: `${(hover / duration) * 100}%` }}>
              {fmtTime(hover)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Dot({ spot, kind }: { spot: Spot; kind: 'note' | 'draft' }) {
  return (
    <span
      className={`dot ${kind === 'note' ? 'pin' : 'draft'}`}
      data-testid={`dot-${kind}`}
      style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%` }}
    />
  )
}
