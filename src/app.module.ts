// ─────────────────────────────────────────────────────────────
// app.module.ts
// The ROOT module — the entry point of the entire application
// Every other module gets imported here
// Think of it as the main() of your NestJS app's module system
// ─────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
// ConfigModule  → loads .env file and makes values available app-wide
// ConfigService → lets us READ those values anywhere via injection

import { MongooseModule } from '@nestjs/mongoose';
// MongooseModule.forRootAsync() → sets up the MongoDB connection for the whole app

import { BullModule } from '@nestjs/bull';
// BullModule.forRootAsync() → sets up Redis connection for BullMQ queues

import { RedisModule } from '@nestjs-modules/ioredis';
// RedisModule → sets up our Redis client (ioredis) for caching

import { SensorsModule } from './sensors/sensors.module';
import { AuthModule } from './auth/auth.module';
import { AlertsModule } from './alerts/alerts.module';
// AlertsModule → we'll build this next (the queue processor)

@Module({
  imports: [
    // ── Config (must be first!) ───────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      // isGlobal: true → makes ConfigService available EVERYWHERE
      // Without this, you'd have to import ConfigModule in every single module
      // With this, any service can inject ConfigService directly
    }),

    // ── MongoDB Connection ────────────────────────────────
    MongooseModule.forRootAsync({
      // forRootAsync = async setup, needed because we read from ConfigService
      // forRoot would be synchronous — can't read .env values that way
      inject: [ConfigService],
      // inject: tells NestJS to provide ConfigService to our factory function

      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
        // config.get('MONGODB_URI') reads MONGODB_URI from our .env file
        // <string> is a TypeScript generic — tells us the expected type
      }),
    }),

    // ── BullMQ (Queue) Redis Connection ───────────────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
          // BullMQ uses Redis as its storage backend
          // Jobs are stored in Redis until a worker picks them up
        },
      }),
    }),

    // ── Redis Cache Connection ────────────────────────────
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'single',
        // type: 'single' = one Redis instance
        // type: 'cluster' would be for Redis Cluster (multiple nodes) in production

        url: `redis://${config.get('REDIS_HOST')}:${config.get('REDIS_PORT')}`,
        // Redis connection URL format: redis://HOST:PORT
        // e.g. redis://localhost:6379
      }),
    }),

    // ── Feature Modules ───────────────────────────────────
    AuthModule,
    // Provides JWT validation and guards to the whole app

    SensorsModule,
    // Handles all sensor reading CRUD + caching + alert queuing

    AlertsModule,
    // Processes alert jobs from the BullMQ queue (we build this next)
  ],
})
export class AppModule {}