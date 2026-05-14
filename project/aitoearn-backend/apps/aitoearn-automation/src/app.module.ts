import { DynamicModule, Module, Type } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { AitoearnAuthModule } from '@yikart/aitoearn-auth'
import { AitoearnQueueModule } from '@yikart/aitoearn-queue'
import { BrowserModule } from './browser/browser.module'
import { config } from './config'
import { CookieVaultModule } from './cookie-vault/cookie-vault.module'
import { AutomationModule } from './workers/automation.module'
import { DouyinModule } from './workers/douyin/douyin.module'
import { XhsModule } from './workers/xhs/xhs.module'

const optionalQueueAndAutomation: Array<DynamicModule | Type<unknown>> = config.queue
  ? [AitoearnQueueModule.forRoot(config.queue), AutomationModule]
  : []

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AitoearnAuthModule.forRoot(config.auth),
    BrowserModule.forRoot(config.browser),
    CookieVaultModule.forRoot(config.cookieVault),
    XhsModule,
    DouyinModule,
    ...optionalQueueAndAutomation,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
