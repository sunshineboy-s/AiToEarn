import { DynamicModule, Module } from '@nestjs/common'
import { BrowserPoolService } from './browser-pool.service'
import { BROWSER_CONFIG, BrowserModuleConfig } from './browser.constants'
import { ProxyService } from './proxy.service'

@Module({})
export class BrowserModule {
  static forRoot(config: BrowserModuleConfig): DynamicModule {
    return {
      module: BrowserModule,
      providers: [
        { provide: BROWSER_CONFIG, useValue: config },
        ProxyService,
        BrowserPoolService,
      ],
      exports: [BrowserPoolService, ProxyService],
      global: true,
    }
  }
}
