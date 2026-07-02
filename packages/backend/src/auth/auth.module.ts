import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';
import { TokenValidator } from './token-validator';
import { EntraTokenValidator } from './entra-token-validator';
import { StubTokenValidator } from './stub-token-validator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthAuditContextProvider } from './auth-audit-context-provider';

/**
 * Auth infrastructure module — flat, leaf-level, no cyclic DI risk.
 * CRITICAL: imports only AppConfigModule and PassportModule. Domain modules must NOT
 * be imported here; the guard is registered globally via APP_GUARD in AppModule.
 * D-08 (Phase 4): auth lives in src/auth/ and is independent of domain bounded contexts.
 */
@Module({
  imports: [AppConfigModule, PassportModule],
  providers: [
    {
      provide: TokenValidator,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        config.get('AUTH_MODE') === 'entra'
          ? new EntraTokenValidator(config)
          : new StubTokenValidator(),
    },
    JwtAuthGuard,
    AuthAuditContextProvider,
  ],
  exports: [TokenValidator, JwtAuthGuard, AuthAuditContextProvider],
})
export class AuthModule {}
