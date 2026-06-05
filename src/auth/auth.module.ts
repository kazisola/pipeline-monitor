import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { ConfigModule } from '@nestjs/config';

import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    ConfigModule,
    // Makes ConfigService injectable in JwtStrategy
  ],

  providers: [
    JwtStrategy,
    // JwtStrategy must be a provider so NestJS knows to instantiate it
    // Passport auto-discovers it because it extends PassportStrategy

    JwtAuthGuard,
    // Register the guard as a provider so it can be injected elsewhere
    // e.g. if we want to apply it globally later
  ],

  exports: [
    JwtAuthGuard,
    PassportModule,
    // Export these so other modules can use JwtAuthGuard
    // without importing the whole auth module setup again
  ],
})
export class AuthModule {}
