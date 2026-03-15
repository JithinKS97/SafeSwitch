import { Module } from '@nestjs/common';
import { SIGNAL_ENGINE } from './signal-engine.interface';
import { DefaultSignalEngineService } from './default-signal-engine.service';

/**
 * Signals Module — proprietary module.
 *
 * Provides a pure-math signal score (0–100) per pair.
 * Swap the implementation by changing the provider binding below.
 */
@Module({
  providers: [
    {
      provide: SIGNAL_ENGINE,
      useClass: DefaultSignalEngineService,
    },
  ],
  exports: [SIGNAL_ENGINE],
})
export class SignalsModule {}
