import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'
import type { Locator, Page } from '@playwright/test'

type ScreenPoint = Readonly<{ x: number; y: number }>

async function canvasBox(canvas: Locator) {
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  return box!
}

async function drag(
  page: Page,
  canvas: Locator,
  button: 'left' | 'right' | 'middle',
  from: ScreenPoint,
  to: ScreenPoint,
) {
  const box = await canvasBox(canvas)
  const webkit = button === 'middle' && await page.evaluate(() => /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium/.test(navigator.userAgent))
  if (webkit) {
    await page.evaluate(({ from, to, box }) => {
      const element = document.querySelector('[data-testid="battle-map-canvas"] canvas')
      if (!(element instanceof HTMLCanvasElement)) throw new Error('missing battle map canvas')
      const emit = (type: 'mousedown' | 'mousemove' | 'mouseup', x: number, y: number) => {
        element.dispatchEvent(new MouseEvent(type, {
          bubbles: true,
          button: type === 'mouseup' ? 1 : 1,
          buttons: type === 'mouseup' ? 0 : 4,
          clientX: box.x + x,
          clientY: box.y + y,
        }))
      }
      emit('mousedown', from.x, from.y)
      emit('mousemove', to.x, to.y)
      emit('mouseup', to.x, to.y)
    }, { from, to, box })
    return
  }
  await page.mouse.move(box.x + from.x, box.y + from.y)
  await page.mouse.down({ button })
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 8 })
  await page.mouse.up({ button })
}

async function fixturePoint(page: Page): Promise<ScreenPoint> {
  const diagnostics = page.getByTestId('scene-performance-diagnostics')
  let encoded = ''
  await expect
    .poll(async () => {
      encoded = (await diagnostics.getAttribute('data-interaction-token-point')) ?? ''
      return encoded
    })
    .not.toBe('')
  return JSON.parse(encoded) as ScreenPoint
}

function normalizedDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

async function hiddenFixturePoint(page: Page, visiblePoint: ScreenPoint): Promise<ScreenPoint> {
  const camera = page.getByTestId('camera-diagnostics')
  const canvas = page.getByTestId('battle-map-canvas')
  const box = await canvasBox(canvas)
  const yaw = (Number(await camera.getAttribute('data-yaw')) * Math.PI) / 180
  const pitch = (Number(await camera.getAttribute('data-pitch')) * Math.PI) / 180
  const zoom = Number(await camera.getAttribute('data-zoom'))
  // The player-safe harness exposes only the visible fixture projection. Derive the
  // hidden fixture's click point from the known fixture-cell delta without publishing
  // a hidden-token diagnostic to the page.
  const deltaX = 112 - 99
  const deltaZ = 100 - 99
  const rightX = Math.cos(yaw)
  const rightZ = -Math.sin(yaw)
  const upX = -Math.sin(yaw) * Math.sin(pitch)
  const upZ = -Math.cos(yaw) * Math.sin(pitch)
  return {
    x: visiblePoint.x + (rightX * deltaX + rightZ * deltaZ) * zoom,
    y: visiblePoint.y - (upX * deltaX + upZ * deltaZ) * zoom,
  }
}

async function nonblank(canvas: Locator) {
  const image = PNG.sync.read(await canvas.screenshot())
  const colors = new Set<string>()
  for (let index = 0; index < image.data.length; index += 4) {
    colors.add(`${image.data[index]}:${image.data[index + 1]}:${image.data[index + 2]}`)
    if (colors.size >= 6) break
  }
  expect(colors.size).toBeGreaterThanOrEqual(6)
}

async function dispatchTwoPointerGesture(page: Page, point: ScreenPoint) {
  await page.evaluate(({ x, y }) => {
    const canvas = document.querySelector('[data-testid="battle-map-canvas"] canvas')
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('missing battle map canvas')
    const emit = (
      type: 'pointerdown' | 'pointermove' | 'pointerup',
      pointerId: number,
      clientX: number,
      clientY: number,
      isPrimary: boolean,
    ) => {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId,
          pointerType: 'touch',
          isPrimary,
          button: type === 'pointerup' ? 0 : 0,
          buttons: type === 'pointerup' ? 0 : 1,
          clientX,
          clientY,
        }),
      )
    }
    emit('pointerdown', 31, x, y, true)
    emit('pointerdown', 32, x + 80, y + 10, false)
    emit('pointermove', 31, x - 40, y + 40, true)
    emit('pointermove', 32, x + 120, y - 30, false)
    emit('pointerup', 31, x - 40, y + 40, true)
    emit('pointerup', 32, x + 120, y - 30, false)
  }, point)
}

test('orbits with right drag while keeping pitch in the tabletop range', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const canvas = page.getByTestId('battle-map-canvas')
  const diagnostics = page.getByTestId('camera-diagnostics')
  await expect(diagnostics).toHaveAttribute('data-yaw', '0.000')
  await fixturePoint(page)

  const box = await canvasBox(canvas)
  await drag(page, canvas, 'right', { x: 160, y: box.height / 2 }, { x: 760, y: box.height / 2 })

  await expect
    .poll(async () => Number(await diagnostics.getAttribute('data-yaw')))
    .not.toBe(0)
  await expect
    .poll(async () => Number(await diagnostics.getAttribute('data-pitch')))
    .toBeGreaterThanOrEqual(35)
  await expect
    .poll(async () => Number(await diagnostics.getAttribute('data-pitch')))
    .toBeLessThanOrEqual(90)
})

test('wheel zoom and middle drag pan without changing Token interaction state', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const canvas = page.getByTestId('battle-map-canvas')
  const camera = page.getByTestId('camera-diagnostics')
  const tokens = page.getByTestId('token-interaction-diagnostics')
  await fixturePoint(page)
  await expect(tokens).toHaveAttribute('data-selected-token-id', '')
  await expect(tokens).toHaveAttribute('data-move-intents', '[]')

  const box = await canvasBox(canvas)
  await page.mouse.move(box.x + 180, box.y + box.height / 2)
  await page.mouse.wheel(0, -800)
  await expect.poll(async () => Number(await camera.getAttribute('data-zoom'))).not.toBe(4)
  const zoom = await camera.getAttribute('data-zoom')

  const focusBefore = await camera.getAttribute('data-focus')
  await drag(page, canvas, 'middle', { x: 600, y: box.height / 2 }, { x: 800, y: box.height / 2 + 120 })
  await expect.poll(async () => camera.getAttribute('data-focus')).not.toBe(focusBefore)
  await expect(camera).toHaveAttribute('data-zoom', zoom ?? '')
  await expect(tokens).toHaveAttribute('data-selected-token-id', '')
  await expect(tokens).toHaveAttribute('data-drag-preview', '')
  await expect(tokens).toHaveAttribute('data-move-intents', '[]')
})

test('camera presets publish their exact logical views', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const canvas = page.getByTestId('battle-map-canvas')
  const camera = page.getByTestId('camera-diagnostics')
  const toolbar = page.getByRole('toolbar', { name: 'Camera view' })
  await fixturePoint(page)

  await toolbar.getByRole('button', { name: 'Top view' }).click()
  await expect(camera).toHaveAttribute('data-yaw', '0.000')
  await expect(camera).toHaveAttribute('data-pitch', '90.000')
  await expect(camera).toHaveAttribute('data-zoom', '4.000')
  await expect(camera).toHaveAttribute('data-focus', '100.000:100.000')

  await toolbar.getByRole('button', { name: 'Reset camera' }).click()
  await expect(camera).toHaveAttribute('data-pitch', '55.000')
  await expect(camera).toHaveAttribute('data-focus', '100.000:100.000')
  const box = await canvasBox(canvas)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, -800)
  await expect.poll(async () => Number(await camera.getAttribute('data-zoom'))).not.toBe(4)
  await drag(page, canvas, 'middle', { x: 600, y: box.height / 2 }, { x: 800, y: box.height / 2 + 120 })
  await expect.poll(async () => camera.getAttribute('data-focus')).not.toBe('100.000:100.000')

  const preservedPitch = await camera.getAttribute('data-pitch')
  const preservedZoom = await camera.getAttribute('data-zoom')
  const preservedFocus = await camera.getAttribute('data-focus')
  await toolbar.getByRole('button', { name: 'Face north' }).click()
  await expect.poll(async () => camera.getAttribute('data-yaw')).toBe('0.000')
  await expect(camera).toHaveAttribute('data-pitch', preservedPitch ?? '')
  await expect(camera).toHaveAttribute('data-zoom', preservedZoom ?? '')
  await expect(camera).toHaveAttribute('data-focus', preservedFocus ?? '')

  await toolbar.getByRole('button', { name: 'Reset camera' }).click()
  await expect(camera).toHaveAttribute('data-yaw', '0.000')
  await expect(camera).toHaveAttribute('data-pitch', '55.000')
  await expect(camera).toHaveAttribute('data-zoom', '4.000')
  await expect(camera).toHaveAttribute('data-focus', '100.000:100.000')
})

test('fades the selected Token occluder and clears it after orbiting behind the wall', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const canvas = page.getByTestId('battle-map-canvas')
  const camera = page.getByTestId('camera-diagnostics')
  const tokens = page.getByTestId('token-interaction-diagnostics')
  const point = await fixturePoint(page)
  const box = await canvasBox(canvas)
  await page.mouse.click(box.x + point.x, box.y + point.y)
  await expect(tokens).toHaveAttribute('data-selected-token-id', 'fixture-token')
  await expect(camera).toHaveAttribute('data-faded-terrain-ids', 'fixture-wall')

  await drag(page, canvas, 'right', { x: 160, y: box.height / 2 }, { x: 3300, y: box.height / 2 })
  await expect
    .poll(async () => {
      const yaw = normalizedDegrees(Number(await camera.getAttribute('data-yaw')))
      return Math.min(yaw, 360 - yaw)
    })
    .toBeGreaterThanOrEqual(135)
  await expect
    .poll(async () => {
      const yaw = normalizedDegrees(Number(await camera.getAttribute('data-yaw')))
      return Math.abs(yaw - 180)
    })
    .toBeLessThanOrEqual(50)
  await expect(camera).toHaveAttribute('data-faded-terrain-ids', '')
})

test('player view cannot select the hidden Token or fade terrain for it', async ({ page }) => {
  await page.goto('/?viewer=player')
  const camera = page.getByTestId('camera-diagnostics')
  const tokens = page.getByTestId('token-interaction-diagnostics')
  await expect(page.getByTestId('visibility-diagnostics')).toHaveAttribute(
    'data-visible-token-ids',
    'fixture-token',
  )
  await expect(tokens).toHaveAttribute('data-selected-token-id', '')
  await expect(camera).toHaveAttribute('data-faded-terrain-ids', '')

  const point = await fixturePoint(page)
  const canvas = page.getByTestId('battle-map-canvas')
  const box = await canvasBox(canvas)
  const hiddenPoint = await hiddenFixturePoint(page, point)
  await page.mouse.click(box.x + hiddenPoint.x, box.y + hiddenPoint.y)
  await expect(tokens).toHaveAttribute('data-selected-token-id', '')
  await expect(camera).toHaveAttribute('data-faded-terrain-ids', '')
})

test('keeps the rendered canvas nonblank at reset, shallow, and top views', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const canvas = page.getByTestId('battle-map-canvas')
  const camera = page.getByTestId('camera-diagnostics')
  const toolbar = page.getByRole('toolbar', { name: 'Camera view' })
  await fixturePoint(page)
  await expect(camera).toHaveAttribute('data-pitch', '55.000')
  await nonblank(canvas)

  const box = await canvasBox(canvas)
  await drag(page, canvas, 'right', { x: 700, y: box.height / 2 }, { x: 700, y: 20 })
  await expect.poll(async () => Number(await camera.getAttribute('data-pitch'))).toBe(35)
  await nonblank(canvas)

  await toolbar.getByRole('button', { name: 'Top view' }).click()
  await expect(camera).toHaveAttribute('data-pitch', '90.000')
  await nonblank(canvas)
})

test('separates one-pointer Token drag from a two-pointer empty-map gesture', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const canvas = page.getByTestId('battle-map-canvas')
  const camera = page.getByTestId('camera-diagnostics')
  const tokens = page.getByTestId('token-interaction-diagnostics')
  const box = await canvasBox(canvas)
  const point = await fixturePoint(page)
  await page.mouse.move(box.x + point.x, box.y + point.y)
  await page.mouse.down()
  await page.mouse.move(box.x + point.x + 108, box.y + point.y, { steps: 4 })
  await expect.poll(async () => {
    const encoded = await tokens.getAttribute('data-drag-preview')
    if (!encoded) return null
    return JSON.parse(encoded) as { tokenId: string; cell: { column: number; row: number } }
  }).toMatchObject({ tokenId: 'fixture-token', cell: { row: 99 } })
  const preview = JSON.parse((await tokens.getAttribute('data-drag-preview')) ?? '{}') as {
    cell?: { column?: number }
  }
  expect(preview.cell?.column).toBeGreaterThan(99)
  await expect(camera).toHaveAttribute('data-yaw', '0.000')
  await page.mouse.up()
  await expect(tokens).toHaveAttribute('data-drag-preview', '')

  const beforeYaw = await camera.getAttribute('data-yaw')
  const beforeZoom = await camera.getAttribute('data-zoom')
  await dispatchTwoPointerGesture(page, { x: box.x + 160, y: box.y + 180 })
  await expect
    .poll(async () => {
      const yaw = await camera.getAttribute('data-yaw')
      const zoom = await camera.getAttribute('data-zoom')
      return yaw !== beforeYaw || zoom !== beforeZoom
    })
    .toBe(true)
  await expect(tokens).toHaveAttribute('data-move-intents', expect.stringContaining('fixture-token'))
})
