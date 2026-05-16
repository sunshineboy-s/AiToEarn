import { createZodDto } from '@yikart/common'
import { z } from 'zod'

/**
 * Optional analytics window. Both fields are ISO YYYY-MM-DD; end is
 * inclusive per the YouTube Analytics convention. If unset, the
 * service defaults to trailing 28 days.
 *
 * Validation rules (applied as zod refines):
 *   - both must be present together (or both absent)
 *   - start must not be after end
 *   - end must not be in the future (Analytics API rejects future dates)
 *   - max span 365 days, both to keep response sizes bounded and to
 *     match what YouTube Studio allows
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const startDateField = z
  .string()
  .regex(ISO_DATE_RE, 'startDate must be ISO YYYY-MM-DD')
  .optional()
  .describe('Window start date (inclusive), YYYY-MM-DD')

const endDateField = z
  .string()
  .regex(ISO_DATE_RE, 'endDate must be ISO YYYY-MM-DD')
  .optional()
  .describe('Window end date (inclusive), YYYY-MM-DD')

interface WindowFields {
  startDate?: string
  endDate?: string
}

function bothPresentTogether(v: WindowFields): boolean {
  return (v.startDate === undefined) === (v.endDate === undefined)
}

function startBeforeEnd(v: WindowFields): boolean {
  return !v.startDate || !v.endDate || v.startDate <= v.endDate
}

function endNotInFuture(v: WindowFields): boolean {
  if (!v.endDate)
    return true
  const today = new Date().toISOString().slice(0, 10)
  return v.endDate <= today
}

function spanWithinYear(v: WindowFields): boolean {
  if (!v.startDate || !v.endDate)
    return true
  const start = Date.parse(`${v.startDate}T00:00:00Z`)
  const end = Date.parse(`${v.endDate}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end))
    return false
  const days = Math.round((end - start) / 86_400_000)
  return days <= 365
}

const AnalyticsWindowSchema = z
  .object({
    startDate: startDateField,
    endDate: endDateField,
  })
  .refine(bothPresentTogether, {
    message: 'startDate and endDate must be provided together',
  })
  .refine(startBeforeEnd, { message: 'startDate must be on or before endDate' })
  .refine(endNotInFuture, { message: 'endDate cannot be in the future' })
  .refine(spanWithinYear, { message: 'window must not exceed 365 days' })

export class YoutubeAnalyticsWindowDto extends createZodDto(AnalyticsWindowSchema) {}

const CountryBreakdownSchema = z
  .object({
    startDate: startDateField,
    endDate: endDateField,
    maxResults: z.coerce
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe('Max rows; defaults to 25'),
  })
  .refine(bothPresentTogether, {
    message: 'startDate and endDate must be provided together',
  })
  .refine(startBeforeEnd, { message: 'startDate must be on or before endDate' })
  .refine(endNotInFuture, { message: 'endDate cannot be in the future' })
  .refine(spanWithinYear, { message: 'window must not exceed 365 days' })

export class YoutubeAnalyticsCountryBreakdownDto extends createZodDto(
  CountryBreakdownSchema,
) {}
