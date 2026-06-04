/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
// import { Injectable } from '@nestjs/common';

// @Injectable()
// export class SensorsService {}

// The business logic layer
// The controller receives requests and calls this service
// talks to MongoDB, Redis, and BullMQ
// ─────────────────────────────────────────────────────────────

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

  // ── Constructor — Dependency Injection ───────────────────
  // NestJS reads these constructor parameters and automatically
  // provides the right instances.  never call `new` myself
  constructor(
    @InjectModel(SensorReading.name)
    private readonly sensorModel: Model<SensorReadingDocument>,
    // sensorModel → MongoDB model, gives .find(), .create() etc.

    @InjectQueue('alerts')
    private readonly alertsQueue: Queue,

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  // ─────────────────────────────────────────────────────────
  // createReading()
  // Called when a sensor posts a new reading to our API
  // Does 3 things:
  //   1. Determines alert level based on threshold
  //   2. Saves the reading to MongoDB
  //   3. Caches the latest reading in Redis
  //   4. If critical/warning → adds a job to the alerts queue
  // ─────────────────────────────────────────────────────────
  async createReading(
    dto: CreateSensorReadingDto,
  ): Promise<SensorReadingDocument> {
    // ── Step 1: Determine Alert Level ──────────────────────
    // Compare the incoming value against the threshold
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const threshold = dto.threshold ?? 0; // Use default value if undefined
    const alertLevel = this.calculateAlertLevel(dto.value, threshold);
    // calculateAlertLevel is a private helper method defined below

    this.logger.log(
      `Saving reading for sensor ${dto.sensorId} | Value: ${dto.value} ${dto.unit} | Alert: ${alertLevel}`,
    );

    // ── Step 2: Save to MongoDB ────────────────────────────
    // this.sensorModel.create() inserts a new document into MongoDB
    // spread the dto (...dto) and add the calculated alertLevel
    // The spread operator (...) copies all properties from dto into the new object
    const reading = await this.sensorModel.create({
      ...dto, // copies: sensorId, pipelineId, type, value, unit, lat, lng etc.
      alertLevel, // adds the alert level we just calculated
    });

    // ── Step 3: Cache in Redis ─────────────────────────────
    // Key format: "sensor:latest:{sensorId}"
    // e.g. "sensor:latest:SENSOR-TX-001"
    // This let me instantly look up the latest reading for any sensor
    const redisKey = `sensor:latest:${dto.sensorId}`;

    await this.redis.set(
      redisKey,
      JSON.stringify(reading), // since Redis only stores strings, so i serialize to JSON
      'EX', // EX = set an expiry time
      300, // 300 seconds = 5 minutes
    );

    // ── Step 4: Queue alert if needed ─────────────────────
    // i don't handle alerts in this same function — that would slow down
    // the HTTP response. Instead i "fire and forget" into the queue.
    // A background worker (alerts.processor.ts) will handle it separately.
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

  // ─────────────────────────────────────────────────────────
  // getLatestReading()
  // Returns the most recent reading for a sensor
  // Strategy: check Redis first (fast), fall back to MongoDB (slower)
  // This pattern is called "cache-aside" or "lazy loading" REMEMBER
  // ─────────────────────────────────────────────────────────
  async getLatestReading(
    sensorId: string,
  ): Promise<SensorReadingDocument | null> {
    const redisKey = `sensor:latest:${sensorId}`;

    // ── Try Redis first ────────────────────────────────────
    const cached = await this.redis.get(redisKey);
    // redis.get() returns the string value, or null if key doesn't exist

    if (cached) {
      this.logger.debug(`Cache HIT for sensor ${sensorId}`);
      // Cache HIT = data was found in Redis → fast path
      return JSON.parse(cached);
      // JSON.parse converts the string back into a JavaScript object
    }

    // ── Cache MISS: fetch from MongoDB ────────────────────
    this.logger.debug(
      `Cache MISS for sensor ${sensorId} — fetching from MongoDB`,
    );
    // Cache MISS = not in Redis → go to MongoDB

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

  // ─────────────────────────────────────────────────────────
  // getAllReadings()
  // Returns paginated sensor readings with optional filters
  // "Paginated" = returns data in pages, not all at once
  // e.g. page 1 = records 1-20, page 2 = records 21-40
  // This is critical for performance — i never return ALL records
  // ─────────────────────────────────────────────────────────
  async getAllReadings(filters: {
    pipelineId?: string; // ? = optional parameter
    alertLevel?: AlertLevel;
    limit?: number;
    skip?: number;
  }) {
    // Build query object — only add filters that were actually provided
    // This is called a "dynamic query"
    const query: any = {};
    if (filters.pipelineId) query.pipelineId = filters.pipelineId;
    if (filters.alertLevel) query.alertLevel = filters.alertLevel;

    return this.sensorModel
      .find(query) // find() with our dynamic filter
      .sort({ createdAt: -1 }) // newest first
      .limit(filters.limit ?? 50) // ?? = nullish coalescing: use 50 if limit is null/undefined
      .skip(filters.skip ?? 0) // skip N records (for pagination)
      .exec();
  }

  // ─────────────────────────────────────────────────────────
  // getPipelineSummary()
  // Returns a live summary of all sensors on a pipeline
  // Used by the dashboard to show the overview cards
  // Uses MongoDB aggregation — powerful data transformation pipeline
  // ─────────────────────────────────────────────────────────
  async getPipelineSummary(pipelineId: string) {
    return this.sensorModel.aggregate([
      // Stage 1: $match — filter documents (like SQL WHERE)
      { $match: { pipelineId } },

      // Stage 2: $group — group documents and compute stats
      {
        $group: {
          _id: '$alertLevel', // Group by alertLevel field
          count: { $sum: 1 }, // Count documents in each group
          avgValue: { $avg: '$value' }, // Average sensor value per alert level
        },
      },

      // Stage 3: $sort — sort results
      { $sort: { _id: 1 } }, // Sort alphabetically by alert level name
    ]);
  }

  // ─────────────────────────────────────────────────────────
  // calculateAlertLevel() — private helper
  // Compares a sensor value to its threshold
  // Returns NORMAL, WARNING, or CRITICAL
  // private = only usable inside this class, not exposed externally
  // ─────────────────────────────────────────────────────────
  private calculateAlertLevel(value: number, threshold: number): AlertLevel {
    if (!threshold) return AlertLevel.NORMAL;
    // If no threshold was set, i can't evaluate — assume normal

    const percentage = (value / threshold) * 100;
    // What % of the threshold is this reading?
    // e.g. value=2700, threshold=3000 → 90%

    if (percentage >= 100) return AlertLevel.CRITICAL; // At or over threshold → CRITICAL
    if (percentage >= 80) return AlertLevel.WARNING; // 80-99% of threshold → WARNING
    return AlertLevel.NORMAL; // Below 80% → all good
  }
}
