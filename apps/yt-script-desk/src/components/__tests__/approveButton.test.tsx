// The Approve button is the owner's, and only on his own machine.
//
// Owner, 2026-09-01: *"This approve button should not be visible on published
// dashboard."* The button is hidden by passing no handler — the same mechanism that
// hides Edit — and the real control is that the hosted Worker has no /api/approve route
// to call. This pins the visible half.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from '../Header'
import { SaveStatusProvider } from '../../hooks/useSaveStatus'
import type { Approval } from '../../types'

function renderHeader(over: {
  approval?: Approval
  onApprove?: () => void
  onUnapprove?: () => void
} = {}) {
  return render(
    <SaveStatusProvider>
      <Header
        title="A video"
        beatCount={4}
        writtenCount={0}
        totalWritable={2}
        tab="write"
        onTabChange={() => {}}
        {...over}
      />
    </SaveStatusProvider>,
  )
}

describe('the approve button', () => {
  it('does not render on the hosted freelancer link', () => {
    // No handler is what the hosted app passes. The maker must not be able to sign off
    // his own brief, and must not even see the control.
    renderHeader()
    expect(
      screen.queryByRole('button', { name: /approve/i }),
      'FREELANCER_CAN_APPROVE: the maker is signing off his own brief',
    ).toBeNull()
  })

  it('offers Approve when the plan has never been signed off', () => {
    renderHeader({ approval: { state: 'none' }, onApprove: () => {} })
    expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy()
  })

  it('reads Approved once signed off, and withdraws on click', () => {
    const onUnapprove = vi.fn()
    renderHeader({
      approval: { state: 'ok', at: '2026-09-01T10:00:00Z', fingerprint: 'f' },
      onApprove: () => {},
      onUnapprove,
    })
    const btn = screen.getByRole('button', { name: 'Approved' })
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    btn.click()
    expect(onUnapprove).toHaveBeenCalled()
  })

  it('asks for a re-approval after the plan changes underneath it', () => {
    // The dangerous state: he approved, then edited. Showing a plain green "Approved"
    // here would be a lie, and publish would refuse anyway — so the desk says so first.
    renderHeader({
      approval: { state: 'stale', at: '2026-09-01T10:00:00Z', fingerprint: 'old' },
      onApprove: () => {},
    })
    const btn = screen.getByRole('button', { name: 'Re-approve' })
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    expect(btn.className).toContain('approve-toggle-stale')
  })
})
