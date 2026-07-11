import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 820, height: 1180 },
] as const

for (const viewport of VIEWPORTS) {
  test(`frames the complete map at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    const canvas = page.getByTestId('battle-map-canvas')
    const tools = page.getByRole('toolbar', { name: 'Map effects' })
    await expect(canvas).toHaveCSS('width', `${viewport.width}px`)
    await expect(canvas).toHaveCSS('height', `${viewport.height}px`)
    await expect(tools).toBeVisible()

    const [canvasBox, toolsBox] = await Promise.all([canvas.boundingBox(), tools.boundingBox()])
    expect(canvasBox).not.toBeNull()
    expect(toolsBox).not.toBeNull()
    expect(toolsBox!.x).toBeGreaterThanOrEqual(0)
    expect(toolsBox!.y).toBeGreaterThanOrEqual(0)
    expect(toolsBox!.x + toolsBox!.width).toBeLessThanOrEqual(viewport.width)
    expect(toolsBox!.y + toolsBox!.height).toBeLessThanOrEqual(viewport.height)

    const image = PNG.sync.read(await canvas.screenshot())
    const colors = new Set<string>()
    for (let index = 0; index < image.data.length; index += 4) {
      colors.add(`${image.data[index]}:${image.data[index + 1]}:${image.data[index + 2]}`)
      if (colors.size >= 6) break
    }
    expect(colors.size).toBeGreaterThanOrEqual(6)
  })
}
