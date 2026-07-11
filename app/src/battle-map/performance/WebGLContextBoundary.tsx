import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

export function bindWebGLContextEvents(
  canvas: HTMLCanvasElement,
  onLost: () => void,
  onRestored: () => void,
): () => void {
  const handleLost = (event: Event) => {
    event.preventDefault()
    onLost()
  }
  canvas.addEventListener('webglcontextlost', handleLost)
  canvas.addEventListener('webglcontextrestored', onRestored)
  return () => {
    canvas.removeEventListener('webglcontextlost', handleLost)
    canvas.removeEventListener('webglcontextrestored', onRestored)
  }
}

type WebGLContextBoundaryProps = Readonly<{
  onLost: () => void
  onRestored: () => void
}>

export function WebGLContextBoundary({ onLost, onRestored }: WebGLContextBoundaryProps) {
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)

  useEffect(
    () =>
      bindWebGLContextEvents(gl.domElement, onLost, () => {
        onRestored()
        invalidate()
      }),
    [gl, invalidate, onLost, onRestored],
  )

  return null
}
