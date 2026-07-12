import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { CameraToolbar } from './CameraToolbar'
import { useBattleMapView } from '../state/useBattleMapView'

beforeEach(() => {
  useBattleMapView.setState(useBattleMapView.getInitialState(), true)
})

afterEach(() => {
  cleanup()
})

it('requests each camera preset with increasing command sequences', () => {
  render(<CameraToolbar />)

  fireEvent.click(screen.getByRole('button', { name: 'Face north' }))
  expect(useBattleMapView.getState().cameraCommand).toEqual({ sequence: 1, preset: 'north' })

  fireEvent.click(screen.getByRole('button', { name: 'Top view' }))
  expect(useBattleMapView.getState().cameraCommand).toEqual({ sequence: 2, preset: 'top' })

  fireEvent.click(screen.getByRole('button', { name: 'Reset camera' }))
  expect(useBattleMapView.getState().cameraCommand).toEqual({ sequence: 3, preset: 'reset' })
})

it('exposes tooltips and decorative Lucide icons for every camera command', () => {
  render(<CameraToolbar />)

  const buttons = screen.getByRole('toolbar', { name: 'Camera view' }).querySelectorAll('button')
  expect(buttons).toHaveLength(3)
  for (const button of buttons) {
    expect(button).toHaveAttribute('title')
    expect(button.getAttribute('title')).not.toBe('')
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  }
})
