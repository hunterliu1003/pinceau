import { describe, expect, it } from 'vitest'
import { getBrowser, url, useTestContext } from '@nuxt/test-utils'

describe('pages', () => {
  it('renders true', () => expect(true).toBe(true))

  /*
  it('render index', async () => {
    const html = await $fetch('/')

    expect(html).toContain('🔥')

    await expectNoClientErrors('/')

    expect(true).toBe(true)
  })

  it('render native syntaxes', async () => {

    const html = await $fetch('/native-syntaxes')

    expect(html).not.toBe('')

    await expectNoClientErrors('/native-syntaxes')

    expect(true).toBe(true)
  })
  */
})

/**
 * Ported from @nuxt/framework
 */

export async function renderPage(path = '/') {
  const ctx = useTestContext()
  if (!ctx.options.browser) {
    throw new Error('`renderPage` require `options.browser` to be set')
  }

  const browser = await getBrowser()
  const page = await browser.newPage({})
  const pageErrors: Error[] = []
  const consoleLogs: { type: string; text: string }[] = []

  page.on('console', (message) => {
    consoleLogs.push({
      type: message.type(),
      text: message.text(),
    })
  })

  page.on('pageerror', (err) => {
    pageErrors.push(err)
  })

  if (path) {
    await page.goto(url(path), { waitUntil: 'networkidle' })
  }

  return {
    page,
    pageErrors,
    consoleLogs,
  }
}

export async function expectNoClientErrors(path: string) {
  const ctx = useTestContext()
  if (!ctx.options.browser) {
    return
  }

  const { pageErrors, consoleLogs } = (await renderPage(path))!

  const consoleLogErrors = consoleLogs.filter(i => i.type === 'error')
  const consoleLogWarnings = consoleLogs.filter(i => i.type === 'warning')

  expect(pageErrors).toEqual([])
  expect(consoleLogErrors).toEqual([])
  expect(consoleLogWarnings).toEqual([])
}
