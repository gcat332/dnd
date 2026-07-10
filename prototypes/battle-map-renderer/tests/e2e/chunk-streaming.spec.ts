import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'

test('switches from overview to detail without breaking the continuous grid', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  const diagnostics = page.getByTestId('chunk-diagnostics')
  await expect(diagnostics).toHaveAttribute('data-mode', 'overview')
  await page.mouse.wheel(0, -2400)
  await expect(diagnostics).toHaveAttribute('data-mode', 'detail')

  const visible = await diagnostics.getAttribute('data-visible-chunks')
  expect(visible?.split(',').length).toBeGreaterThan(1)
  const canvas = page.getByTestId('battle-map-canvas')
  const frame = PNG.sync.read(await canvas.screenshot())
  let blankPixels = 0
  for (let index = 0; index < frame.data.length; index += 4) {
    if (frame.data[index]! < 8 && frame.data[index + 1]! < 8 && frame.data[index + 2]! < 8) {
      blankPixels += 1
    }
  }
  expect(blankPixels / (frame.width * frame.height)).toBeLessThan(0.001)

  await expect(canvas).toHaveScreenshot('detail-chunks.png', {
    maxDiffPixelRatio: 0.01,
  })
})
