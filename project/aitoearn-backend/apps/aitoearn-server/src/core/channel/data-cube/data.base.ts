import {
  ChannelAccountDataBulk,
  ChannelAccountDataCube,
  ChannelArcDataBulk,
  ChannelArcDataCube,
} from '../platforms/common'

/**
 * 受众画像分布行（年龄段 × 性别 × 比例 / 计数）
 *
 * 这是 YouTube `viewerPercentage` 和 IG `engaged_audience_demographics`
 * 这两个完全不同形状的 API 拉平后的最大公因子：
 *   ageGroup × gender × value
 *
 * 各平台的 value 含义略有差异：
 * - YouTube: 百分比（0-100）
 * - Instagram: engaged audience 计数
 * 字段 `unit` 用来在响应里直接告诉前端这是百分比还是计数。
 */
export interface AudienceDemographicsRow {
  /** 年龄段，例如 "age25-34" / "25-34" — 各平台原样字符串保持，不强行规范化 */
  ageGroup?: string
  /** 性别，例如 "male" / "female" / "M" / "F" — 同上 */
  gender?: string
  /** 度量值 */
  value: number
  /** value 的单位：percentage（0-100） 或 count（绝对人数） */
  unit?: 'percentage' | 'count'
}

/**
 * 平台数据立方体的最小契约。
 *
 * 设计原则（RFC 0001 §7）：
 * - 5 个核心方法（accountDataCube/Bulk + arcDataCube/Bulk +
 *   accountPortraitReport）所有平台**必须**实现，由 base class 强制
 * - 深度维度（受众画像 / 流量来源 / 设备类型 / 视频留存 / 国家 / 城市
 *   / 关注流失 / 等）是**可选**：base class 提供 not-supported 默认实现，
 *   平台 service 想覆盖就覆盖。这避免了把每个平台特有 API 都强行塞进
 *   shared interface 造成的虚假一致。
 * - 路由层 (data-cube.controller.ts) 用平台白名单+硬绑定来暴露深度维度，
 *   不依赖鸭子类型。
 */
export abstract class DataCubeBase {
  /**
   * 上报用户数据
   * @param accountId
   */
  abstract accountPortraitReport(
    accountId: string,
  ): Promise<void>

  // 获取账号的统计数据
  abstract getAccountDataCube(
    accountId: string,
  ): Promise<ChannelAccountDataCube>

  // 获取账号的增量数据
  abstract getAccountDataBulk(
    accountId: string,
  ): Promise<ChannelAccountDataBulk>

  // 获取作品的统计数据
  abstract getArcDataCube(
    accountId: string,
    dataId: string,
  ): Promise<ChannelArcDataCube>

  // 获取作品的增量数据
  abstract getArcDataBulk(
    accountId: string,
    dataId: string,
  ): Promise<ChannelArcDataBulk>

  /**
   * 受众画像（可选能力）
   *
   * 已实现的平台：YouTube、Instagram。
   * 其他平台 fallback 到空数组，调用方自行处理。
   *
   * 不在这里强制 abstract 是因为大部分平台没有公开的 demographics API
   * （快手、视频号、B 站 OAuth、抖音 OAuth、TikTok Display 都不给）。
   * 强行 abstract 会逼着这些 service 写假的"return []"实现，反而模糊了
   * "这个能力到底有没有"。
   */
  async getAudienceDemographics(_accountId: string): Promise<AudienceDemographicsRow[]> {
    return []
  }
}
