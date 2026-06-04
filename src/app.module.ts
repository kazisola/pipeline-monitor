import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { MongooseModule } from '@nestjs/mongoose';

import { BullModule } from '@nestjs/bull';

import { RedisModule } from '@nestjs-modules/ioredis';

import { SensorsModule } from './sensors/sensors.module';
import { AuthModule } from './auth/auth.module';
import { AlertsModule } from './alerts/alerts.module';

@Module({
  imports: [
    // Config with love
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // My MongoDB Connection
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      // inject: tells NestJS to provide ConfigService to my factory function

      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
      }),
    }),

    // My BullMQ (Queue) Redis Connection
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
        },
      }),
    }),

    // Redis Cache Connection
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'single',
        // type: 'single' = one Redis instance
        // type: 'cluster' would be for Redis Cluster (multiple nodes) in production

        url: `redis://${config.get('REDIS_HOST')}:${config.get('REDIS_PORT')}`,
        // Redis connection URL format: redis://HOST:PORT like redis://localhost:6379
      }),
    }),

    // Feature Modules
    AuthModule,
    // This will provide JWT validation and guards to the whole app

    SensorsModule,
    // Handles all sensor reading CRUD + caching + alert queuing

    AlertsModule,
    // Processes alert jobs from the BullMQ queue
  ],
})
export class AppModule {}
