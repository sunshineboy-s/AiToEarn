/// <reference lib="dom" />
import type { Page } from 'playwright'
import { Injectable, Logger } from '@nestjs/common'
import { BrowserPoolService } from '../../browser/browser-pool.service'
import { CookieVaultService } from '../../cookie-vault/cookie-vault.service'
import { ActionResult } from '../xhs/xhs.types'
import { DouyinSelectors } from './douyin.selectors'
import {
  DouyinLikeData,
  DouyinReplyData,
  DouyinSearchData,
  DouyinSearchItem,
} from './douyin.types'

const PLATFORM = 'douyin'
const ACTION_TIMEOUT_MS = 60_000
const SHORT_TIMEOUT_MS = 8_000

/**
 * Douyin automation worker. Mirrors {@link XhsService} 1:1 in shape so the
 * BullMQ consumer can route between the two with no special-casing. The
 * cookie vault key is `douyin:<accountId>`.
 *
 * The like/favorite buttons toggle, so each action checks the active state
 * before clicking — this makes the handlers idempotent and the breaker
 * tolerant of accidental double-clicks.
 */
@Injectable()
export class DouyinService {
  private readonly logger = new Logger(DouyinService.name)

  constructor(
    private readonly browserPool: BrowserPoolService,
    private readonly cookieVault: CookieVaultService,
  ) {}

  async likeVideo(accountId: string, videoUrl: string): Promise<ActionResult<DouyinLikeData>> {
    return this.run<DouyinLikeData>(accountId, async (page) => {
      const videoId = this.extractVideoId(videoUrl)
      await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await this.browserPool.humanDelay()

      const likeButton = await this.firstVisible(page, DouyinSelectors.video.likeButton)
      if (!likeButton)
        return { success: false, error: 'like button not found (selector drift?)' }

      const wasLiked = await this.isActive(likeButton, DouyinSelectors.video.likedClass)
      if (wasLiked) {
        return {
          success: true,
          data: {
            videoId,
            alreadyLiked: true,
            likeCount: await this.readFirstText(page, DouyinSelectors.video.likeCount),
          },
        }
      }

      await likeButton.click({ delay: 80 + Math.floor(Math.random() * 120) })
      await this.browserPool.humanDelay()
      return {
        success: true,
        data: {
          videoId,
          alreadyLiked: false,
          likeCount: await this.readFirstText(page, DouyinSelectors.video.likeCount),
        },
      }
    })
  }

  async unlikeVideo(accountId: string, videoUrl: string): Promise<ActionResult<DouyinLikeData>> {
    return this.run<DouyinLikeData>(accountId, async (page) => {
      const videoId = this.extractVideoId(videoUrl)
      await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await this.browserPool.humanDelay()

      const likeButton = await this.firstVisible(page, DouyinSelectors.video.likeButton)
      if (!likeButton)
        return { success: false, error: 'like button not found' }

      const wasLiked = await this.isActive(likeButton, DouyinSelectors.video.likedClass)
      if (!wasLiked)
        return { success: true, data: { videoId, alreadyLiked: false } }

      await likeButton.click({ delay: 60 })
      await this.browserPool.humanDelay()
      return { success: true, data: { videoId, alreadyLiked: false } }
    })
  }

  async favoriteVideo(accountId: string, videoUrl: string): Promise<ActionResult<DouyinLikeData>> {
    return this.run<DouyinLikeData>(accountId, async (page) => {
      const videoId = this.extractVideoId(videoUrl)
      await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await this.browserPool.humanDelay()

      const fav = await this.firstVisible(page, DouyinSelectors.video.favoriteButton)
      if (!fav)
        return { success: false, error: 'favorite button not found' }

      const already = await this.isActive(fav, DouyinSelectors.video.favoritedClass)
      if (!already) {
        await fav.click({ delay: 70 })
        await this.browserPool.humanDelay()
      }
      return { success: true, data: { videoId, alreadyLiked: already } }
    })
  }

  async unfavoriteVideo(accountId: string, videoUrl: string): Promise<ActionResult<DouyinLikeData>> {
    return this.run<DouyinLikeData>(accountId, async (page) => {
      const videoId = this.extractVideoId(videoUrl)
      await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await this.browserPool.humanDelay()

      const fav = await this.firstVisible(page, DouyinSelectors.video.favoriteButton)
      if (!fav)
        return { success: false, error: 'favorite button not found' }

      const already = await this.isActive(fav, DouyinSelectors.video.favoritedClass)
      if (already) {
        await fav.click({ delay: 60 })
        await this.browserPool.humanDelay()
      }
      return { success: true, data: { videoId, alreadyLiked: false } }
    })
  }

  async followUser(accountId: string, target: string): Promise<ActionResult<{ targetUserId: string }>> {
    return this.run<{ targetUserId: string }>(accountId, async (page) => {
      await page.goto(this.toProfileUrl(target), { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await this.browserPool.humanDelay()

      const button = await this.firstVisible(page, DouyinSelectors.profile.followButton)
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
      await page.goto(this.toProfileUrl(target), { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await this.browserPool.humanDelay()

      const button = await this.firstVisible(page, DouyinSelectors.profile.followButton)
      if (!button)
        return { success: false, error: 'follow button not found' }
      const text = (await button.textContent().catch(() => null))?.trim() ?? ''
      const alreadyFollowing = /\u5df2\u5173\u6ce8|following/i.test(text)
      if (!alreadyFollowing)
        return { success: true, data: { targetUserId: target } }
      await button.click({ delay: 60 })
      await this.browserPool.humanDelay()
      const confirm = await this.firstVisible(page, DouyinSelectors.profile.unfollowConfirm)
      if (confirm)
        await confirm.click({ delay: 60 })
      return { success: true, data: { targetUserId: target } }
    })
  }

  async replyToVideo(
    accountId: string,
    videoUrl: string,
    comment: string,
  ): Promise<ActionResult<DouyinReplyData>> {
    return this.run<DouyinReplyData>(accountId, async (page) => {
      const videoId = this.extractVideoId(videoUrl)
      await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await this.browserPool.humanDelay()

      const input = await this.firstVisible(page, DouyinSelectors.video.commentInput)
      if (!input)
        return { success: false, error: 'comment input not found' }
      await input.click({ delay: 60 })
      await this.browserPool.humanDelay()
      await input.type(comment, { delay: 70 })

      const submit = await this.firstVisible(page, DouyinSelectors.video.commentSubmit)
      if (!submit)
        return { success: false, error: 'submit button not found' }
      await submit.click({ delay: 80 })
      await page.waitForTimeout(1500)
      return { success: true, data: { videoId, comment } }
    })
  }

  async search(
    accountId: string,
    keyword: string,
    limit: number,
  ): Promise<ActionResult<DouyinSearchData>> {
    return this.run<DouyinSearchData>(accountId, async (page) => {
      const url = `https://www.douyin.com/search/${encodeURIComponent(keyword)}?type=video`
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS })
      await page.waitForSelector(DouyinSelectors.search.container, { timeout: SHORT_TIMEOUT_MS }).catch(() => {})
      await this.browserPool.humanDelay()

      // lazy-load second page worth of results
      for (let i = 0; i < 2; i++) {
        await page.mouse.wheel(0, 800)
        await page.waitForTimeout(700)
      }

      const items = await page.$$eval(
        DouyinSelectors.search.item,
        (anchors, sel) => {
          const seen = new Set<string>()
          const out: DouyinSearchItem[] = []
          const text = (root: Element, selector: string): string | undefined => {
            const el = root.querySelector(selector)
            const value = el?.textContent?.trim()
            return value && value.length > 0 ? value : undefined
          }
          for (const node of anchors) {
            const a = node as HTMLAnchorElement
            const href = a.href || ''
            const m = href.match(/\/video\/(\d{15,})/)
            const videoId = m?.[1] ?? href
            if (!videoId || seen.has(videoId))
              continue
            seen.add(videoId)
            const card = (a.closest('.video-card-container, [data-e2e="scroll-list-item"]') ?? a) as Element
            const title = text(card, sel.itemTitle) ?? ''
            const authorName = text(card, sel.itemAuthor)
            const likeCount = text(card, sel.itemLike)
            const thumb = card.querySelector(sel.itemThumb) as HTMLImageElement | null
            const thumbnail = thumb?.src
            out.push({ videoId, title, url: href, authorName, likeCount, thumbnail })
          }
          return out
        },
        {
          itemTitle: DouyinSelectors.search.itemTitle,
          itemAuthor: DouyinSelectors.search.itemAuthor,
          itemLike: DouyinSelectors.search.itemLike,
          itemThumb: DouyinSelectors.search.itemThumb,
        },
      )
      const truncated: DouyinSearchItem[] = items.slice(0, limit)
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
      this.logger.warn(`douyin:${accountId} has no cookies; proceeding anonymously (likely to fail)`)
    const ownerKey = `${PLATFORM}:${accountId}`
    const { page, release } = await this.browserPool.acquire(ownerKey, cookies)
    try {
      return await fn(page)
    }
    catch (err) {
      const message = (err as Error).message ?? String(err)
      this.logger.error(`douyin action failed for ${ownerKey}: ${message}`)
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

  private async isActive(handle: ReturnType<Page['locator']>, klass: string): Promise<boolean> {
    return handle
      .evaluate(
        (el, { klass, attr }) => {
          const e = el as Element
          if (e.classList.contains(klass))
            return true
          // support data-active="true" style toggles
          return e.getAttribute(attr) === 'true'
        },
        { klass, attr: 'data-active' },
      )
      .catch(() => false)
  }

  private extractVideoId(videoUrl: string): string {
    const m = videoUrl.match(/\/video\/(\d{15,})/)
    return m?.[1] ?? videoUrl
  }

  private toProfileUrl(target: string): string {
    if (/^https?:\/\//i.test(target))
      return target
    // Douyin uses /user/<sec_uid>; pass-through when target looks like one.
    return `https://www.douyin.com/user/${target}`
  }
}
