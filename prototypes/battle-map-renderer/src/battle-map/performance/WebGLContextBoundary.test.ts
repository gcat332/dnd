import { expect, it, vi } from 'vitest'
import { bindWebGLContextEvents } from './WebGLContextBoundary'

it('prevents default context loss and reports restoration until disposed', () => {
  const canvas = document.createElement('canvas')
  const onLost = vi.fn()
  const onRestored = vi.fn()
  const dispose = bindWebGLContextEvents(canvas, onLost, onRestored)
  const lost = new Event('webglcontextlost', { cancelable: true })

  canvas.dispatchEvent(lost)
  canvas.dispatchEvent(new Event('webglcontextrestored'))

  expect(lost.defaultPrevented).toBe(true)
  expect(onLost).toHaveBeenCalledOnce()
  expect(onRestored).toHaveBeenCalledOnce()

  dispose()
  canvas.dispatchEvent(new Event('webglcontextrestored'))
  expect(onRestored).toHaveBeenCalledOnce()
})
