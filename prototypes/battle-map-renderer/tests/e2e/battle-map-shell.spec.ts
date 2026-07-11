import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'

test('renders a nonblank, viewport-filling battle map', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  const canvas = page.getByTestId('battle-map-canvas')
  const toolbar = page.getByRole('toolbar', { name: 'Map effects' })
  await expect(canvas).toHaveCSS('width', '1280px')
  await expect(canvas).toHaveCSS('height', '744px')
  const [canvasBox, toolbarBox] = await Promise.all([canvas.boundingBox(), toolbar.boundingBox()])
  expect(canvasBox).not.toBeNull()
  expect(toolbarBox).not.toBeNull()
  expect(toolbarBox!.y + toolbarBox!.height).toBeLessThanOrEqual(canvasBox!.y)

  const image = PNG.sync.read(await canvas.screenshot())
  const colors = new Set<string>()
  for (let index = 0; index < image.data.length; index += 4) {
    colors.add(`${image.data[index]}:${image.data[index + 1]}:${image.data[index + 2]}`)
    if (colors.size >= 3) break
  }
  expect(colors.size).toBeGreaterThanOrEqual(3)
})
