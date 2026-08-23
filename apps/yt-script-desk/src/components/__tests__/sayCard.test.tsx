import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SayCard } from '../SayCard'

function noop() {}

describe('SayCard', () => {
  it('pressing Edit opens the confirmation and does not make the card editable', () => {
    render(<SayCard lines={['Locked line.']} onSave={noop} onRestore={noop} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByRole('alertdialog'), 'LOCK_BYPASSED: confirm dialog did not open').toBeTruthy()
    expect(screen.queryByRole('textbox'), 'LOCK_BYPASSED: card became editable without confirmation').toBeNull()
  })

  it('No closes the dialog and the card stays locked', () => {
    render(<SayCard lines={['Locked line.']} onSave={noop} onRestore={noop} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'No' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('textbox'), 'LOCK_BYPASSED: card became editable after declining').toBeNull()
  })

  it('Yes closes the dialog and makes the card editable', () => {
    render(<SayCard lines={['Locked line.']} onSave={noop} onRestore={noop} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('the dialog heading is exact and the dialog holds no textarea or input', () => {
    render(<SayCard lines={['Locked line.']} onSave={noop} onRestore={noop} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    const dialog = screen.getByRole('alertdialog')
    expect(dialog.querySelector('h2')?.textContent).toBe('Are you sure you want to make these changes?')
    expect(dialog.querySelector('textarea')).toBeNull()
    expect(dialog.querySelector('input')).toBeNull()
  })

  it('Escape acts as No', () => {
    render(<SayCard lines={['Locked line.']} onSave={noop} onRestore={noop} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('a beat with an edits entry renders the edited strip with a Restore original control', () => {
    render(
      <SayCard
        lines={['Edited line.']}
        editedInfo={{ original: ['Original line.'], at: '2026-08-23T10:00:00.000Z' }}
        onSave={noop}
        onRestore={noop}
      />,
    )

    expect(screen.getByText('You changed this line')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Restore original/ })).toBeTruthy()
  })
})
