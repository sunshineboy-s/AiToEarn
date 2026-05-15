/**
 * Typed shapes for YouTube Analytics API v2 (`youtubeAnalytics.reports.query`).
 *
 * The raw API returns `{ columnHeaders: [{name}], rows: any[][] }` — we keep
 * that shape and add interpreted shapes per report so downstream code is
 * not stringly-typed. Callers should prefer the interpreted shape.
 *
 * Scope required: `https://www.googleapis.com/auth/yt-analytics.readonly`
 * (already provisioned in YoutubeService.getAuthUrl).
 *
 * Docs: https://developers.google.com/youtube/analytics/reference/reports/query
 */

/** A single day in a daily time-series. */
export interface YoutubeAnalyticsDailyPoint {
  /** ISO date (YYYY-MM-DD) */
  day: string
  views: number
  /** Average view duration in seconds */
  averageViewDuration: number
  /** Average % of video watched, 0..100 */
  averageViewPercentage: number
  estimatedMinutesWatched: number
  likes: number
  comments: number
  shares: number
  subscribersGained: number
  subscribersLost: number
}

/** Geo breakdown row. */
export interface YoutubeAnalyticsCountryRow {
  country: string
  views: number
  estimatedMinutesWatched: number
  averageViewDuration: number
}

/** Audience age × gender breakdown row. */
export interface YoutubeAnalyticsDemographicsRow {
  /** YouTube uses bucket strings: age13-17, age18-24, age25-34, ... */
  ageGroup: string
  /** female / male / user_specified */
  gender: string
  /** Percentage of total viewer-minutes, 0..100 */
  viewerPercentage: number
}

/** Traffic source breakdown row. */
export interface YoutubeAnalyticsTrafficSourceRow {
  /** YT_SEARCH, EXT_URL, RELATED_VIDEO, ... */
  insightTrafficSourceType: string
  views: number
  estimatedMinutesWatched: number
}

/** Per-second retention row for a single video. */
export interface YoutubeAnalyticsRetentionRow {
  /** Position in video as a ratio, 0..1 */
  elapsedVideoTimeRatio: number
  /** Audience retention as a ratio, 0..1 */
  audienceWatchRatio: number
  /** Relative audience retention (compared to other videos of similar length), 0..1 */
  relativeRetentionPerformance: number
}

/**
 * Common query input. `ids` is always `channel==MINE` for user-scoped requests.
 * `startDate` / `endDate` are ISO YYYY-MM-DD.
 */
export interface YoutubeAnalyticsQueryWindow {
  startDate: string
  endDate: string
}
