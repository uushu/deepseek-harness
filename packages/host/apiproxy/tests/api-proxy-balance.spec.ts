/**
 * `llm.balance` host behavior: resolves the official DeepSeek key through the
 * credentials seam, asks the provider's balance endpoint, and maps the answer
 * — failing soft (null) on any missing piece so the surface hides the row.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { fetchDeepSeekBalance } from '../src/api-proxy.ts'

function stubFetch(body: unknown, ok = true): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({
    ok,
    json: async () => body,
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => { vi.unstubAllGlobals() })

function credentialsResolving(value: string | undefined): Context {
  const ctx = new Context()
  ctx.provide('credentials', { resolve: async () => value === undefined ? undefined : { value } } as never)
  return ctx
}

describe('fetchDeepSeekBalance', () => {
  it('maps the first non-zero currency balance', async () => {
    const fetchMock = stubFetch({
      is_available: true,
      balance_infos: [
        { currency: 'CNY', total_balance: '0', granted_balance: '0', topped_up_balance: '0' },
        { currency: 'USD', total_balance: '12.34', granted_balance: '2.00', topped_up_balance: '10.34' },
      ],
    })
    expect(await fetchDeepSeekBalance(credentialsResolving('sk-test'))).toEqual({
      currency: 'USD',
      total: '12.34',
      granted: '2.00',
      toppedUp: '10.34',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/user/balance',
      expect.objectContaining({ headers: { authorization: 'Bearer sk-test' } }),
    )
  })

  it('answers null without a stored credential', async () => {
    expect(await fetchDeepSeekBalance(credentialsResolving(undefined))).toBeNull()
  })

  it('answers null without a credentials seam', async () => {
    expect(await fetchDeepSeekBalance(new Context())).toBeNull()
  })

  it('answers null on a non-OK provider response', async () => {
    stubFetch({ error: 'unauthorized' }, false)
    expect(await fetchDeepSeekBalance(credentialsResolving('sk-test'))).toBeNull()
  })

  it('answers null on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('provider down') }))
    expect(await fetchDeepSeekBalance(credentialsResolving('sk-test'))).toBeNull()
  })
})
