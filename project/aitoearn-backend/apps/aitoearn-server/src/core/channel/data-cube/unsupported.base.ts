import { Logger } from '@nestjs/common'
import {
  ChannelAccountDataBulk,
  ChannelAccountDataCube,
  ChannelArcDataBulk,
  ChannelArcDataCube,
} from '../platforms/common'
import { DataCubeBase } from './data.base'

/**
 * Base class for data-cube services that have no working backend yet.
 *
 * Per RFC 0001 §7 ("real-vs-stub separation"), stubs must NOT silently
 * return zero — they emit a structured warn log on every call so ops
 * can grep for unsupported reads, and they still return zero-valued
 * objects so consumers don't crash.
 *
 * Subclasses override only the methods they actually implement.
 */
export abstract class BaseUnsupportedDataCubeService extends DataCubeBase {
  protected abstract readonly platform: string
  protected abstract readonly logger: Logger
  protected abstract readonly unsupportedReason: string

  protected warn(method: string, ctx: Record<string, unknown>) {
    this.logger.warn({
      path: `${this.platform}.${method}.unsupported`,
      reason: this.unsupportedReason,
      ...ctx,
    })
  }

  async accountPortraitReport(accountId: string): Promise<void> {
    this.warn('accountPortraitReport', { accountId })
  }

  async getAccountDataCube(accountId: string): Promise<ChannelAccountDataCube> {
    this.warn('getAccountDataCube', { accountId })
    return {}
  }

  async getAccountDataBulk(accountId: string): Promise<ChannelAccountDataBulk> {
    this.warn('getAccountDataBulk', { accountId })
    return { list: [] }
  }

  async getArcDataCube(
    accountId: string,
    dataId: string,
  ): Promise<ChannelArcDataCube> {
    this.warn('getArcDataCube', { accountId, dataId })
    return {}
  }

  async getArcDataBulk(
    accountId: string,
    dataId: string,
  ): Promise<ChannelArcDataBulk> {
    this.warn('getArcDataBulk', { accountId, dataId })
    return { recordId: '', dataId: '', list: [] }
  }
}
