import { useState, useMemo } from 'react'
import type { VideoDoc, HeygenEngine } from '../types'
import { resolveBeatParagraphs } from './FullScript'
import {
  selectionsFromRanges,
  totalWords,
  countByEngine,
} from '../lib/selectionsFile'
import type { DraftRange, RenderedParagraph } from '../lib/selectionsFile'
import { putHeygenSelections } from '../api'
import './AvatarMode.css'

export type AvatarModeProps = {
  doc: VideoDoc
  onSubmitted: () => void
}

function groupHeading(beat: any): string {
  if (beat.section) return beat.section
  const part = (beat.part ?? '').replace(/^\s*\d+\s*·\s*/, '').trim()
  if (!part) return beat.partKind === 'intro' ? 'Intro' : 'Conclusion'
  return part.charAt(0) + part.slice(1).toLowerCase()
}

function resolveParagraphs(doc: VideoDoc): RenderedParagraph[] {
  const result: RenderedParagraph[] = []
  let currentGroup = ''
  let sectionIndex = 0
  
  for (const beat of doc.beats) {
    const group = groupHeading(beat)
    if (group !== currentGroup) {
      currentGroup = group
      sectionIndex++
    }
    const section_id = `s${String(sectionIndex).padStart(2, '0')}`
    
    const paras = resolveBeatParagraphs(beat, doc)
    for (const text of paras) {
      result.push({
        section_id,
        beat_num: beat.num,
        text,
      })
    }
  }
  return result
}

export function AvatarMode({ doc, onSubmitted }: AvatarModeProps) {
  const [defaultEngine, setDefaultEngine] = useState<HeygenEngine>('heygen4')
  const [overrides, setOverrides] = useState<Record<string, HeygenEngine>>({})
  const [ranges, setRanges] = useState<DraftRange[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const paragraphs = useMemo(() => resolveParagraphs(doc), [doc])

  const selections = useMemo(
    () => selectionsFromRanges(ranges, paragraphs, defaultEngine, overrides),
    [ranges, paragraphs, defaultEngine, overrides]
  )

  const words = totalWords(selections)
  const counts = countByEngine(selections)
  
  // Disable if already submitted
  const disabled = saved || saving

  const handleMouseUp = () => {
    if (disabled) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return

    const anchorNode = sel.anchorNode
    const focusNode = sel.focusNode
    if (!anchorNode || !focusNode) return

    const anchorPara = anchorNode.parentElement?.closest('[data-para-idx]')
    const focusPara = focusNode.parentElement?.closest('[data-para-idx]')

    if (!anchorPara || !focusPara) return

    const startIdx = parseInt(anchorPara.getAttribute('data-para-idx') || '-1', 10)
    const endIdx = parseInt(focusPara.getAttribute('data-para-idx') || '-1', 10)

    if (startIdx === -1 || endIdx === -1) return
    
    if (startIdx !== endIdx) {
      alert("highlight one paragraph at a time")
      sel.removeAllRanges()
      return
    }

    // Determine actual offsets based on anchor/focus order
    const range = sel.getRangeAt(0)
    const preSelectionRange = range.cloneRange()
    preSelectionRange.selectNodeContents(anchorPara)
    preSelectionRange.setEnd(range.startContainer, range.startOffset)
    const startOffset = preSelectionRange.toString().length
    const textLen = range.toString().length
    const endOffset = startOffset + textLen

    setRanges((prev) => [
      ...prev,
      { startParaIdx: startIdx, startOffset, endParaIdx: startIdx, endOffset }
    ])
    sel.removeAllRanges()
  }

  const handleRemove = (id: string) => {
    if (disabled) return
    const idx = selections.findIndex(s => s.id === id)
    if (idx !== -1) {
      setRanges(prev => {
        const newRanges = [...prev]
        newRanges.splice(idx, 1)
        return newRanges
      })
      setOverrides(prev => {
        const newOverrides = { ...prev }
        delete newOverrides[id]
        return newOverrides
      })
    }
  }

  const toggleOverride = (id: string, current: HeygenEngine) => {
    if (disabled) return
    setOverrides(prev => ({
      ...prev,
      [id]: current === 'heygen4' ? 'heygen3' : 'heygen4'
    }))
  }

  const submit = async () => {
    setSaving(true)
    setErrorMsg('')
    try {
      await putHeygenSelections(doc.key, {
        default_engine: defaultEngine,
        selections: selections.map(s => ({
          section_id: s.section_id,
          engine: s.engine,
          text: s.text
        }))
      })
      setSaved(true)
      onSubmitted()
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving selections')
      setSaving(false)
    }
  }

  return (
    <div className="avatar-mode">
      <div className="avatar-mode__top">
        <div className="avatar-mode__top-left">
          <span className="avatar-mode__key">{doc.key}</span>
          <span className="avatar-mode__chip">Editor View</span>
        </div>
        <div className="avatar-mode__top-right">
          <label>Default engine:</label>
          <select 
            value={defaultEngine} 
            onChange={e => setDefaultEngine(e.target.value as HeygenEngine)}
            disabled={disabled}
          >
            <option value="heygen4">heygen4</option>
            <option value="heygen3">heygen3</option>
          </select>
        </div>
      </div>
      
      {errorMsg && <div className="avatar-mode__error">{errorMsg}</div>}
      
      <div className="avatar-mode__body">
        <div className="avatar-mode__left" onMouseUp={handleMouseUp}>
          {paragraphs.map((p, idx) => (
            <p key={idx} data-para-idx={idx} className="avatar-mode__para">
              {p.text}
            </p>
          ))}
        </div>
        
        <div className="avatar-mode__right">
          <div className="avatar-mode__queue">
            {selections.map(s => (
              <div key={s.id} className="avatar-mode__card">
                <div className="avatar-mode__card-header">
                  <span className="avatar-mode__card-section">{s.section_id}</span>
                  <span className="avatar-mode__card-words">{s.text_word_count} words</span>
                  <button 
                    className="avatar-mode__engine-toggle"
                    onClick={() => toggleOverride(s.id, s.engine)}
                    disabled={disabled}
                  >
                    {s.engine === 'heygen3' ? 'III' : 'IV'}
                  </button>
                  <button 
                    className="avatar-mode__card-remove" 
                    onClick={() => handleRemove(s.id)}
                    disabled={disabled}
                  >×</button>
                </div>
                <div className="avatar-mode__card-text">
                  {s.text.length > 90 ? s.text.slice(0, 90) + '...' : s.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="avatar-mode__footer">
        <div className="avatar-mode__footer-stats">
          <span>Total selections: {selections.length}</span>
          <span>Total words: {words}</span>
          <span>{counts.heygen3} on III, {counts.heygen4} on IV</span>
        </div>
        <button 
          className="avatar-mode__submit" 
          onClick={submit} 
          disabled={disabled || selections.length === 0}
        >
          {saved ? 'Saved' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
