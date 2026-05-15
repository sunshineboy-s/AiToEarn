import { DynamicModule, Module } from '@nestjs/common'
import { COOKIE_VAULT_CONFIG, CookieVaultModuleConfig } from './cookie-vault.constants'
import { CookieVaultService } from './cookie-vault.service'

@Module({})
export class CookieVaultModule {
  static forRoot(config: CookieVaultModuleConfig): DynamicModule {
    return {
      module: CookieVaultModule,
      providers: [
        { provide: COOKIE_VAULT_CONFIG, useValue: config },
        CookieVaultService,
      ],
      exports: [CookieVaultService],
      global: true,
    }
  }
}
