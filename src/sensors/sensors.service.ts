/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
// import { Injectable } from '@nestjs/common';

// @Injectable()
// export class SensorsService {}

import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { InjectQueue } from '@nestjs/bull';

import { InjectRedis } from '@nestjs-modules/ioredis';

import type { Model } from 'mongoose';

import type { Queue } from 'bull';

import type { Redis } from 'ioredis';

import {
  SensorReading,
  SensorReadingDocument,
  AlertLevel,
} from './schemas/sensor-reading.schema';

import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';
// DTO = Data Transfer Object
// defines the shape of data coming IN from HTTP requests
// i'll create this file next

@Injectable()
export class SensorsService {
  private readonly logger = new Logger(SensorsService.name);

  constructor(
    @InjectModel(SensorReading.name)
    private readonly sensorModel: Model<SensorReadingDocument>,

    @InjectQueue('alerts')
    private readonly alertsQueue: Queue,

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async createReading(
    dto: CreateSensorReadingDto,
  ): Promise<SensorReadingDocument> {

    const threshold = dto.threshold ?? 0; // Use default value if undefined
    const alertLevel = this.calculateAlertLevel(dto.value, threshold);
    // calculateAlertLevel is a private helper method defined below

    this.logger.log(
      `Saving reading for sensor ${dto.sensorId} | Value: ${dto.value} ${dto.unit} | Alert: ${alertLevel}`,
    );

    const reading = await this.sensorModel.create({
      ...dto, // copies: sensorId, pipelineId, type, value, unit, lat, lng etc.
      alertLevel, // adds the alert level we just calculated
    });

    const redisKey = `sensor:latest:${dto.sensorId}`;

    await this.redis.set(
      redisKey,
      JSON.stringify(reading), // since Redis only stores strings, so i serialize to JSON
      'EX', // EX = set an expiry time
      300, // 300 seconds = 5 minutes
    );

    if (
      alertLevel === AlertLevel.CRITICAL ||
      alertLevel === AlertLevel.WARNING
    ) {
      await this.alertsQueue.add(
        'process-alert', // Job name — the processor listens for this specific name
        {
          // Job data — everything the processor needs to handle the alert
          sensorId: reading.sensorId,
          pipelineId: reading.pipelineId,
          type: reading.type,
          value: reading.value,
          unit: reading.unit,
          location: reading.location,
          alertLevel,
          timestamp: new Date().toISOString(), // ISO format: "2024-01-15T14:30:00.000Z"
        },
        {
          attempts: 3, // If the job fails, retry up to 3 times
          backoff: 5000, // Wait 5 seconds between retries
          // backoff = the delay before retrying a failed job
          removeOnComplete: true, // Clean up successful jobs from Redis automatically
        },
      );
      this.logger.warn(
        `🚨 Alert queued for sensor ${dto.sensorId}: ${alertLevel}`,
      );
    }

    return reading;
  }

  async getLatestReading(
    sensorId: string,
  ): Promise<SensorReadingDocument | null> {
    const redisKey = `sensor:latest:${sensorId}`;

    // Try Redis first
    const cached = await this.redis.get(redisKey);
    // redis.get() returns the string value, or null if key doesn't exist

    if (cached) {
      this.logger.debug(`Cache HIT for sensor ${sensorId}`);
      // Cache HIT = data was found in Redis → fast path
      return JSON.parse(cached);
      // JSON.parse converts the string back into a JavaScript object
    }

    // Cache MISS: fetch from MongoDB
    this.logger.debug(
      `Cache MISS for sensor ${sensorId} — fetching from MongoDB`,
    );
    // Cache MISS = not in Redis > go to MongoDB

    const reading = await this.sensorModel
      .findOne({ sensorId }) // Find ONE document where sensorId matches
      .sort({ createdAt: -1 }) // Sort by createdAt descending (-1 = newest first)
      .exec(); // .exec() actually runs the query and returns a Promise

    if (reading) {
      // Re-populate the cache so next request is fast again
      await this.redis.set(redisKey, JSON.stringify(reading), 'EX', 300);
    }

    return reading;
  }

  async getAllReadings(filters: {
    pipelineId?: string;
    alertLevel?: AlertLevel;
    limit?: number;
    skip?: number;
  }) {

    const query: any = {};
    if (filters.pipelineId) query.pipelineId = filters.pipelineId;
    if (filters.alertLevel) query.alertLevel = filters.alertLevel;

    return this.sensorModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit ?? 50)
      .skip(filters.skip ?? 0)
      .exec();
  }

  async getPipelineSummary(pipelineId: string) {
    return this.sensorModel.aggregate([
      { $match: { pipelineId } },

      {
        $group: {
          _id: '$alertLevel',
          count: { $sum: 1 },
          avgValue: { $avg: '$value' },
        },
      },

      { $sort: { _id: 1 } },
    ]);
  }

  private calculateAlertLevel(value: number, threshold: number): AlertLevel {
    if (!threshold) return AlertLevel.NORMAL;
    // If no threshold was set, i can't evaluate — assume normal

    const percentage = (value / threshold) * 100;
    // What % of the threshold is this reading?
    // e.g. value=2700, threshold=3000 > 90%

    if (percentage >= 100) return AlertLevel.CRITICAL; // At or over threshold > CRITICAL
    if (percentage >= 80) return AlertLevel.WARNING; // 80-99% of threshold > WARNING
    return AlertLevel.NORMAL; // Below 80% > all good
  }
}
