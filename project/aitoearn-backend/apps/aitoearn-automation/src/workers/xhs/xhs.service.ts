/// <reference lib="dom" />
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
    return this.run<XhsLikeData>(accountId, async (page) => {
      const noteId = this.extractNoteId(noteUrl)
      await page.goto(noteUrl, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await this.browserPool.humanDelay()

      const likeButton = await this.firstVisible(page, XhsSelectors.note.likeButton)
      if (!likeButton)
        return { success: false, error: 'like button not found (selector drift?)' }

      const wasLiked = await likeButton.evaluate(
        (el, klass) => (el as Element).classList.contains(klass),
        XhsSelectors.note.likedClass,
      )
      if (wasLiked) {
        const data: XhsLikeData = {
          noteId,
          alreadyLiked: true,
          likeCount: await this.readFirstText(page, XhsSelectors.note.likeCount),
        }
        return { success: true, data }
      }

      await likeButton.click({ delay: 80 + Math.floor(Math.random() * 120) })
      await this.browserPool.humanDelay()

      const data: XhsLikeData = {
        noteId,
        alreadyLiked: false,
        likeCount: await this.readFirstText(page, XhsSelectors.note.likeCount),
      }
      return { success: true, data }
    })
  }

  /**
   * Inverse of {@link likeNote}. The XHS like button toggles, so we click only
   * if the note is currently liked. Idempotent — safe to retry.
   */
  async unlikeNote(accountId: string, noteUrl: string): Promise<ActionResult<XhsLikeData>> {
    return this.run<XhsLikeData>(accountId, async (page) => {
      const noteId = this.extractNoteId(noteUrl)
      await page.goto(noteUrl, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await this.browserPool.humanDelay()

      const likeButton = await this.firstVisible(page, XhsSelectors.note.likeButton)
      if (!likeButton)
        return { success: false, error: 'like button not found (selector drift?)' }

      const wasLiked = await likeButton.evaluate(
        (el, klass) => (el as Element).classList.contains(klass),
        XhsSelectors.note.likedClass,
      )
      if (!wasLiked) {
        return {
          success: true,
          data: { noteId, alreadyLiked: false, likeCount: await this.readFirstText(page, XhsSelectors.note.likeCount) },
        }
      }
      await likeButton.click({ delay: 60 })
      await this.browserPool.humanDelay()
      return {
        success: true,
        data: { noteId, alreadyLiked: false, likeCount: await this.readFirstText(page, XhsSelectors.note.likeCount) },
      }
    })
  }

  /**
   * Favourite (collect) — same toggle pattern as like. Selector resolution
   * lives in xhs.selectors.ts so DOM drift is grep-able.
   */
  async favoriteNote(accountId: string, noteUrl: string): Promise<ActionResult<XhsLikeData>> {
    return this.run<XhsLikeData>(accountId, async (page) => {
      const noteId = this.extractNoteId(noteUrl)
      await page.goto(noteUrl, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await this.browserPool.humanDelay()

      const fav = await this.firstVisible(page, XhsSelectors.note.favoriteButton)
      if (!fav)
        return { success: false, error: 'favorite button not found (selector drift?)' }

      const already = await fav.evaluate(
        (el, klass) => (el as Element).classList.contains(klass),
        XhsSelectors.note.favoritedClass,
      )
      if (!already) {
        await fav.click({ delay: 70 })
        await this.browserPool.humanDelay()
      }
      return { success: true, data: { noteId, alreadyLiked: already } }
    })
  }

  async unfavoriteNote(accountId: string, noteUrl: string): Promise<ActionResult<XhsLikeData>> {
    return this.run<XhsLikeData>(accountId, async (page) => {
      const noteId = this.extractNoteId(noteUrl)
      await page.goto(noteUrl, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await this.browserPool.humanDelay()

      const fav = await this.firstVisible(page, XhsSelectors.note.favoriteButton)
      if (!fav)
        return { success: false, error: 'favorite button not found' }

      const already = await fav.evaluate(
        (el, klass) => (el as Element).classList.contains(klass),
        XhsSelectors.note.favoritedClass,
      )
      if (already) {
        await fav.click({ delay: 60 })
        await this.browserPool.humanDelay()
      }
      return { success: true, data: { noteId, alreadyLiked: false } }
    })
  }

  /**
   * Follow a user. `target` accepts either a profile URL or a userId; we
   * normalise to the canonical profile URL and click the Follow CTA.
   */
  async followUser(accountId: string, target: string): Promise<ActionResult<{ targetUserId: string }>> {
    return this.run<{ targetUserId: string }>(accountId, async (page) => {
      const profileUrl = this.toProfileUrl(target)
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await this.browserPool.humanDelay()

      const button = await this.firstVisible(page, XhsSelectors.profile.followButton)
      if (!button)
        return { success: false, error: 'follow button not found' }

      const text = (await button.textContent().catch(() => null))?.trim() ?? ''
      const alreadyFollowing = /\u5df2\u5173\u6ce8|following/i.test(text)
      if (alreadyFollowing)
        return { success: true, data: { targetUserId: target } }

      await button.click({ delay: 80 })
      await this.browserPool.humanDelay()
      return { success: true, data: { targetUserId: target } }
    })
  }

  async unfollowUser(accountId: string, target: string): Promise<ActionResult<{ targetUserId: string }>> {
    return this.run<{ targetUserId: string }>(accountId, async (page) => {
      const profileUrl = this.toProfileUrl(target)
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await this.browserPool.humanDelay()

      const button = await this.firstVisible(page, XhsSelectors.profile.followButton)
      if (!button)
        return { success: false, error: 'follow button not found' }

      const text = (await button.textContent().catch(() => null))?.trim() ?? ''
      const alreadyFollowing = /\u5df2\u5173\u6ce8|following/i.test(text)
      if (!alreadyFollowing)
        return { success: true, data: { targetUserId: target } }

      await button.click({ delay: 60 })
      await this.browserPool.humanDelay()
      // XHS shows a confirm dialog for unfollow — best-effort dismiss
      const confirm = await this.firstVisible(page, XhsSelectors.profile.unfollowConfirm)
      if (confirm)
        await confirm.click({ delay: 60 })
      await this.browserPool.humanDelay()
      return { success: true, data: { targetUserId: target } }
    })
  }

  async replyToNote(
    accountId: string,
    noteUrl: string,
    comment: string,
  ): Promise<ActionResult<XhsReplyData>> {
    return this.run<XhsReplyData>(accountId, async (page) => {
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

      const data: XhsReplyData = { noteId, comment }
      return { success: true, data }
    })
  }

  async search(
    accountId: string,
    keyword: string,
    limit: number,
  ): Promise<ActionResult<XhsSearchData>> {
    return this.run<XhsSearchData>(accountId, async (page) => {
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
          // Helpers run inside the page, so DOM types are available there.
          const text = (root: Element, selector: string): string | undefined => {
            const el = root.querySelector(selector)
            const value = el?.textContent?.trim()
            return value && value.length > 0 ? value : undefined
          }
          for (const node of anchors) {
            const a = node as HTMLAnchorElement
            const href = a.href || ''
            const m = href.match(/\/(?:explore|discovery\/item|search_result)\/([0-9a-f]{20,})/i)
            const noteId = m?.[1] ?? href
            if (!noteId || seen.has(noteId))
              continue
            seen.add(noteId)
            const card = (a.closest('section, .note-item, .feed-item') ?? a) as Element
            const title = text(card, sel.itemTitle) ?? ''
            const authorName = text(card, sel.itemAuthor)
            const likeCount = text(card, sel.itemLike)
            const thumb = card.querySelector(sel.itemThumb) as HTMLImageElement | null
            const thumbnail = thumb?.src
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
      this.logger.warn(`xhs:${accountId} has no cookies; proceeding anonymously (likely to fail)`)

    const ownerKey = `${PLATFORM}:${accountId}`
    const { page, release } = await this.browserPool.acquire(ownerKey, cookies, { accountId })
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
      const handle = page.locator(sel).first()
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
      const text = await page.locator(sel).first().textContent().catch(() => null)
      const trimmed = text?.trim()
      if (trimmed && trimmed.length > 0)
        return trimmed
    }
    return undefined
  }

  private extractNoteId(noteUrl: string): string {
    const m = noteUrl.match(/\/(?:explore|discovery\/item|search_result)\/([0-9a-f]{20,})/i)
    return m?.[1] ?? noteUrl
  }

  /**
   * Accept a profile URL, a `user/<id>` path, or a bare userId. The xhs web
   * profile lives at `/user/profile/<id>`.
   */
  private toProfileUrl(target: string): string {
    if (/^https?:\/\//i.test(target))
      return target
    const m = target.match(/([0-9a-f]{8,})$/i)
    const id = m?.[1] ?? target
    return `https://www.xiaohongshu.com/user/profile/${id}`
  }
}
