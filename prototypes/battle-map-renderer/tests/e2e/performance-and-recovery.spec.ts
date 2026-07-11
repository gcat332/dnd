import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'

function expectNonblankCanvas(buffer: Buffer): void {
  const image = PNG.sync.read(buffer)
  const colors = new Set<string>()
  for (let index = 0; index < image.data.length; index += 4) {
    colors.add(`${image.data[index]}:${image.data[index + 1]}:${image.data[index + 2]}`)
    if (colors.size >= 6) return
  }
  expect(colors.size).toBeGreaterThanOrEqual(6)
}

function hasMinimumColors(buffer: Buffer, minimum: number): boolean {
  const image = PNG.sync.read(buffer)
  const colors = new Set<string>()
  for (let index = 0; index < image.data.length; index += 4) {
    colors.add(`${image.data[index]}:${image.data[index + 1]}:${image.data[index + 2]}`)
    if (colors.size >= minimum) return true
  }
  return false
}

test('profiles 200 objects, applies low quality, and recovers the committed scene', async ({ page }) => {
  test.setTimeout(45_000)
  await page.goto('/?stress=1')
  const diagnostics = page.getByTestId('scene-performance-diagnostics')
  const canvas = page.getByTestId('battle-map-canvas')

  await expect(diagnostics).toHaveAttribute('data-object-count', '200')
  await expect
    .poll(async () => Number(await diagnostics.getAttribute('data-frame-samples')), { timeout: 10_000 })
    .toBeGreaterThan(5)
  await canvas.click({ position: { x: 20, y: 80 } })
  await expect
    .poll(async () => {
      const current = JSON.parse((await diagnostics.getAttribute('data-metrics')) ?? '{}') as Record<string, number>
      return current.p95InputLatencyMs
    })
    .toBeGreaterThan(0)
  const checksum = await diagnostics.getAttribute('data-token-checksum')
  const metrics = JSON.parse((await diagnostics.getAttribute('data-metrics')) ?? '{}') as Record<string, number>
  expect(metrics.averageFps).toBeGreaterThan(0)
  expect(metrics.p95FrameTimeMs).toBeGreaterThan(0)
  expect(metrics.drawCalls).toBeGreaterThan(0)
  expect(metrics.triangles).toBeGreaterThan(0)
  expect(metrics.textures).toBeGreaterThanOrEqual(0)
  expect(metrics.p95ChunkLatencyMs).toBeGreaterThan(0)

  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('battle-map:set-quality', { detail: { quality: 'low' } })),
  )
  await expect(diagnostics).toHaveAttribute('data-quality', 'low')
  await expect(diagnostics).toHaveAttribute('data-max-dpr', '1')
  await expect(diagnostics).toHaveAttribute('data-shadow-map-size', '512')
  await expect(diagnostics).toHaveAttribute('data-particle-scale', '0.25')
  await expect(diagnostics).toHaveAttribute('data-post-processing', 'false')

  const usedExtension = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const context = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl')
    const extension = context?.getExtension('WEBGL_lose_context')
    if (extension) {
      ;(window as typeof window & { __battleMapContextLoss?: WEBGL_lose_context }).__battleMapContextLoss = extension
      extension.loseContext()
    }
    else canvas?.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    return Boolean(extension)
  })
  await expect(page.getByTestId('webgl-recovery')).toBeVisible()

  if (usedExtension) {
    await page.evaluate(() => {
      ;(window as typeof window & { __battleMapContextLoss?: WEBGL_lose_context }).__battleMapContextLoss?.restoreContext()
    })
  } else {
    await page.getByRole('button', { name: 'Retry renderer' }).click()
  }

  await expect(page.getByTestId('webgl-recovery')).toBeHidden()
  await expect(diagnostics).toHaveAttribute('data-token-checksum', checksum ?? '')
  await expect.poll(async () => hasMinimumColors(await canvas.screenshot(), 6)).toBe(true)
  expectNonblankCanvas(await canvas.screenshot())
})
