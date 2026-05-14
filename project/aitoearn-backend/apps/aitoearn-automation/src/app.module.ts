import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { AitoearnAuthModule } from '@yikart/aitoearn-auth'
import { BrowserModule } from './browser/browser.module'
import { config } from './config'
import { CookieVaultModule } from './cookie-vault/cookie-vault.module'
import { XhsModule } from './workers/xhs/xhs.module'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AitoearnAuthModule.forRoot(config.auth),
    BrowserModule.forRoot(config.browser),
    CookieVaultModule.forRoot(config.cookieVault),
    XhsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
