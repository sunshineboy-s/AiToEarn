import type { Page } from 'playwright'
import { Injectable, Logger } from '@nestjs/common'
import { BrowserPoolService } from '../../browser/browser-pool.service'
import { CookieVaultService } from '../../cookie-vault/cookie-vault.service'
import { XhsSelectors } from './xhs.selectors'
import {
  ActionResult,
  XhsLikeData,
  XhsReplyData,
  XhsSearchData,
  XhsSearchItem,
} from './xhs.types'

const PLATFORM = 'xhs'
const ACTION_TIMEOUT_MS = 60_000
const SHORT_TIMEOUT_MS = 8_000

@Injectable()
export class XhsService {
  private readonly logger = new Logger(XhsService.name)

  constructor(
    private readonly browserPool: BrowserPoolService,
    private readonly cookieVault: CookieVaultService,
  ) {}

  async likeNote(accountId: string, noteUrl: string): Promise<ActionResult<XhsLikeData>> {
    return this.run(accountId, async (page) => {
      const noteId = this.extractNoteId(noteUrl)
      await page.goto(noteUrl, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await this.browserPool.humanDelay()

      const likeButton = await this.firstVisible(page, XhsSelectors.note.likeButton)
      if (!likeButton) {
        return { success: false, error: 'like button not found (selector drift?)' }
      }

      const wasLiked = await likeButton.evaluate(
        (el, klass) => el.classList.contains(klass),
        XhsSelectors.note.likedClass,
      )
      if (wasLiked) {
        return {
          success: true,
          data: {
            noteId,
            alreadyLiked: true,
            likeCount: await this.readFirstText(page, XhsSelectors.note.likeCount),
          },
        }
      }

      await likeButton.click({ delay: 80 + Math.floor(Math.random() * 120) })
      await this.browserPool.humanDelay()

      return {
        success: true,
        data: {
          noteId,
          alreadyLiked: false,
          likeCount: await this.readFirstText(page, XhsSelectors.note.likeCount),
        },
      }
    })
  }

  async replyToNote(
    accountId: string,
    noteUrl: string,
    comment: string,
  ): Promise<ActionResult<XhsReplyData>> {
    return this.run(accountId, async (page) => {
      const noteId = this.extractNoteId(noteUrl)
      await page.goto(noteUrl, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await this.browserPool.humanDelay()

      const input = await this.firstVisible(page, XhsSelectors.note.commentInput)
      if (!input)
        return { success: false, error: 'comment input not found' }

      await input.click({ delay: 60 })
      await this.browserPool.humanDelay()
      // type slowly: ~70ms per char to look human, capped at 600ms total slack
      await input.type(comment, { delay: 70 })

      const submit = await this.firstVisible(page, XhsSelectors.note.commentSubmit)
      if (!submit)
        return { success: false, error: 'submit button not found' }

      await submit.click({ delay: 80 })
      await page.waitForTimeout(1500)

      return { success: true, data: { noteId, comment } }
    })
  }

  async search(
    accountId: string,
    keyword: string,
    limit: number,
  ): Promise<ActionResult<XhsSearchData>> {
    return this.run(accountId, async (page) => {
      const url = `https://www.xiaohongshu.com/search_result/?keyword=${encodeURIComponent(keyword)}&source=web_explore_feed`
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await page.waitForSelector(XhsSelectors.search.container, { timeout: SHORT_TIMEOUT_MS }).catch(() => {})
      await this.browserPool.humanDelay()

      // best-effort: scroll twice to lazy-load more cards
      for (let i = 0; i < 2; i++) {
        await page.mouse.wheel(0, 800)
        await page.waitForTimeout(700)
      }

      const items = await page.$$eval(
        XhsSelectors.search.item,
        (anchors, sel) => {
          const seen = new Set<string>()
          const out: { noteId: string, title: string, url: string, authorName?: string, likeCount?: string, thumbnail?: string }[] = []
          for (const a of anchors as HTMLAnchorElement[]) {
            const href = a.href || ''
            const m = href.match(/\/(?:explore|discovery\/item|search_result)\/([0-9a-f]{20,})/i)
            const noteId = m?.[1] ?? href
            if (!noteId || seen.has(noteId))
              continue
            seen.add(noteId)
            const card = a.closest('section, .note-item, .feed-item') ?? a
            const title = (card.querySelector(sel.itemTitle) as HTMLElement | null)?.innerText?.trim() ?? ''
            const authorName = (card.querySelector(sel.itemAuthor) as HTMLElement | null)?.innerText?.trim() ?? undefined
            const likeCount = (card.querySelector(sel.itemLike) as HTMLElement | null)?.innerText?.trim() ?? undefined
            const thumbnail = (card.querySelector(sel.itemThumb) as HTMLImageElement | null)?.src ?? undefined
            out.push({ noteId, title, url: href, authorName, likeCount, thumbnail })
          }
          return out
        },
        { itemTitle: XhsSelectors.search.itemTitle, itemAuthor: XhsSelectors.search.itemAuthor, itemLike: XhsSelectors.search.itemLike, itemThumb: XhsSelectors.search.itemThumb },
      )

      const truncated: XhsSearchItem[] = items.slice(0, limit)
      return { success: true, data: { keyword, items: truncated } }
    })
  }

  // ---------------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------------

  private async run<T>(
    accountId: string,
    fn: (page: Page) => Promise<ActionResult<T>>,
  ): Promise<ActionResult<T>> {
    const cookies = this.cookieVault.get(PLATFORM, accountId)
    if (!cookies.length)
      this.logger.warn(`xhs:${accountId} has no cookies — proceeding anonymously (likely to fail)`)

    const ownerKey = `${PLATFORM}:${accountId}`
    const { page, release } = await this.browserPool.acquire(ownerKey, cookies)
    try {
      return await fn(page)
    }
    catch (err) {
      const message = (err as Error).message ?? String(err)
      this.logger.error(`xhs action failed for ${ownerKey}: ${message}`)
      return { success: false, error: message }
    }
    finally {
      await release()
    }
  }

  private async firstVisible(page: Page, selectors: readonly string[]) {
    for (const sel of selectors) {
      const handle = await page.locator(sel).first()
      if (await handle.count().catch(() => 0)) {
        try {
          await handle.waitFor({ state: 'visible', timeout: SHORT_TIMEOUT_MS })
          return handle
        }
        catch {
          /* try next */
        }
      }
    }
    return null
  }

  private async readFirstText(page: Page, selectors: readonly string[]): Promise<string | undefined> {
    for (const sel of selectors) {
      const text = await page.locator(sel).first().innerText().catch(() => '')
      if (text)
        return text.trim()
    }
    return undefined
  }

  private extractNoteId(noteUrl: string): string {
    const m = noteUrl.match(/\/(?:explore|discovery\/item|search_result)\/([0-9a-f]{20,})/i)
    return m?.[1] ?? noteUrl
  }
}
