import { DynamicModule, Module } from '@nestjs/common'
import { BrowserPoolService } from './browser-pool.service'
import { BROWSER_CONFIG, BrowserModuleConfig } from './browser.constants'

@Module({})
export class BrowserModule {
  static forRoot(config: BrowserModuleConfig): DynamicModule {
    return {
      module: BrowserModule,
      providers: [
        { provide: BROWSER_CONFIG, useValue: config },
        BrowserPoolService,
      ],
      exports: [BrowserPoolService],
      global: true,
    }
  }
}
