import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { PNG } from 'pngjs'

type Frame = Readonly<{ data: Uint8Array; width: number; height: number }>
type Region = Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>

const FEATURE_REGIONS = {
  overview: {
    road: { minX: 600, minY: 350, maxX: 680, maxY: 410 },
    water: { minX: 790, minY: 350, maxX: 850, maxY: 440 },
  },
  detail: {
    road: { minX: 580, minY: 145, maxX: 700, maxY: 260 },
    water: { minX: 1190, minY: 330, maxX: 1279, maxY: 470 },
  },
} as const

function countPixels(
  frame: Frame,
  region: Region,
  predicate: (red: number, green: number, blue: number) => boolean,
): number {
  let count = 0
  for (let y = region.minY; y <= region.maxY; y += 1) {
    for (let x = region.minX; x <= region.maxX; x += 1) {
      const index = (y * frame.width + x) * 4
      if (predicate(frame.data[index]!, frame.data[index + 1]!, frame.data[index + 2]!)) count += 1
    }
  }
  return count
}

function expectRenderedMap(frame: Frame): void {
  const fullFrame = { minX: 0, minY: 0, maxX: frame.width - 1, maxY: frame.height - 1 }
  const backgroundPixels = countPixels(
    frame,
    fullFrame,
    (red, green, blue) => Math.abs(red - 23) <= 3 && Math.abs(green - 26) <= 3 && Math.abs(blue - 31) <= 3,
  )
  expect(1 - backgroundPixels / (frame.width * frame.height)).toBeGreaterThan(0.25)
}

function worldFeatureCounts(frame: Frame, mode: keyof typeof FEATURE_REGIONS): { road: number; water: number } {
  const { road, water } = FEATURE_REGIONS[mode]
  const scale = (region: Region): Region => ({
    minX: Math.floor((region.minX / 1280) * frame.width),
    minY: Math.floor((region.minY / 800) * frame.height),
    maxX: Math.floor((region.maxX / 1280) * frame.width),
    maxY: Math.floor((region.maxY / 800) * frame.height),
  })
  return {
    road: countPixels(frame, scale(road), (red, green, blue) => red > green + 5 && green > blue + 10),
    water: countPixels(frame, scale(water), (red, green, blue) => blue > green + 5 && green > red + 20),
  }
}

async function captureWorldFeatures(canvas: Locator, mode: keyof typeof FEATURE_REGIONS): Promise<Frame> {
  let frame: Frame | undefined
  await expect
    .poll(async () => {
      frame = PNG.sync.read(await canvas.screenshot())
      const features = worldFeatureCounts(frame, mode)
      return Math.min(features.road, features.water)
    })
    .toBeGreaterThan(50)
  return frame!
}

test('rejects a frame containing only the renderer background', () => {
  const background = new PNG({ width: 16, height: 16 })
  for (let index = 0; index < background.data.length; index += 4) {
    background.data[index] = 23
    background.data[index + 1] = 26
    background.data[index + 2] = 31
    background.data[index + 3] = 255
  }

  expect(() => expectRenderedMap(background)).toThrow()
})

test('switches from overview to detail without breaking the continuous grid', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  const diagnostics = page.getByTestId('chunk-diagnostics')
  await expect(diagnostics).toHaveAttribute('data-mode', 'overview')
  const canvas = page.getByTestId('battle-map-canvas')
  const overviewFrame = await captureWorldFeatures(canvas, 'overview')
  expectRenderedMap(overviewFrame)
  await expect(canvas).toHaveScreenshot('overview-map.png', { maxDiffPixelRatio: 0.01 })

  const canvasBox = await canvas.boundingBox()
  expect(canvasBox).not.toBeNull()
  await page.mouse.move(canvasBox!.x + canvasBox!.width / 2, canvasBox!.y + canvasBox!.height / 2)
  await page.mouse.wheel(0, -2400)
  await expect(diagnostics).toHaveAttribute('data-mode', 'detail')

  const visible = await diagnostics.getAttribute('data-visible-chunks')
  expect(visible?.split(',').length).toBeGreaterThan(1)
  const detailFrame = await captureWorldFeatures(canvas, 'detail')
  expectRenderedMap(detailFrame)

  await expect(canvas).toHaveScreenshot('detail-chunks.png', {
    maxDiffPixelRatio: 0.01,
  })
})
