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
    await page.goto('/__harness')
    const canvas = page.getByTestId('battle-map-canvas')
    const tools = page.getByRole('toolbar', { name: 'Map effects' })
    const cameraTools = page.getByRole('toolbar', { name: 'Camera view' })
    await expect(tools).toBeVisible()
    await expect(cameraTools).toBeVisible()

    const terrainPanel = page.locator('.terrain-editor-panel')
    await expect(terrainPanel).toHaveCount(1)
    await expect(terrainPanel).toBeVisible()

    const [canvasBox, toolsBox, cameraBox, terrainBox] = await Promise.all([
      canvas.boundingBox(),
      tools.boundingBox(),
      cameraTools.boundingBox(),
      terrainPanel.boundingBox(),
    ])
    expect(canvasBox).not.toBeNull()
    expect(toolsBox).not.toBeNull()
    expect(cameraBox).not.toBeNull()
    expect(terrainBox).not.toBeNull()
    expect(terrainBox!.width).toBeGreaterThan(0)
    expect(terrainBox!.height).toBeGreaterThan(0)
    expect(toolsBox!.x).toBeGreaterThanOrEqual(0)
    expect(toolsBox!.y).toBeGreaterThanOrEqual(0)
    expect(toolsBox!.x + toolsBox!.width).toBeLessThanOrEqual(viewport.width)
    expect(toolsBox!.y + toolsBox!.height).toBeLessThanOrEqual(viewport.height)
    expect(toolsBox!.y + toolsBox!.height).toBeLessThanOrEqual(canvasBox!.y)
    expect(cameraBox!.x).toBeGreaterThanOrEqual(canvasBox!.x)
    expect(cameraBox!.y).toBeGreaterThanOrEqual(canvasBox!.y)
    expect(cameraBox!.x + cameraBox!.width).toBeLessThanOrEqual(canvasBox!.x + canvasBox!.width)
    expect(cameraBox!.y + cameraBox!.height).toBeLessThanOrEqual(canvasBox!.y + canvasBox!.height)
    expect(cameraBox!.x).toBeGreaterThanOrEqual(toolsBox!.x + toolsBox!.width)
    expect(canvasBox!.x).toBeGreaterThanOrEqual(0)
    expect(canvasBox!.y + canvasBox!.height).toBeLessThanOrEqual(viewport.height)

    const overlaps =
      cameraBox!.x < terrainBox!.x + terrainBox!.width &&
      cameraBox!.x + cameraBox!.width > terrainBox!.x &&
      cameraBox!.y < terrainBox!.y + terrainBox!.height &&
      cameraBox!.y + cameraBox!.height > terrainBox!.y
    expect(overlaps).toBe(false)

    await expect.poll(async () => {
      const image = PNG.sync.read(await canvas.screenshot())
      const colors = new Set<string>()
      for (let index = 0; index < image.data.length; index += 4) {
        colors.add(`${image.data[index]}:${image.data[index + 1]}:${image.data[index + 2]}`)
        if (colors.size >= 6) break
      }
      return colors.size
    }).toBeGreaterThanOrEqual(6)
  })
}
