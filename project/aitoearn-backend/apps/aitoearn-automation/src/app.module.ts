import { DynamicModule, Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { AitoearnAuthModule } from '@yikart/aitoearn-auth'
import { AitoearnQueueModule } from '@yikart/aitoearn-queue'
import { BrowserModule } from './browser/browser.module'
import { config } from './config'
import { CookieVaultModule } from './cookie-vault/cookie-vault.module'
import { XhsModule } from './workers/xhs/xhs.module'

const optionalQueue: DynamicModule[] = config.queue
  ? [AitoearnQueueModule.forRoot(config.queue)]
  : []

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AitoearnAuthModule.forRoot(config.auth),
    BrowserModule.forRoot(config.browser),
    CookieVaultModule.forRoot(config.cookieVault),
    ...optionalQueue,
    XhsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
