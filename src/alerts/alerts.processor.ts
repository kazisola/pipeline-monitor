import {
  Processor,
  Process,
  OnQueueFailed,
  OnQueueCompleted,
} from '@nestjs/bull';

import { Logger } from '@nestjs/common';
import type { Job } from 'bull';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Alert, AlertDocument } from './schemas/alert.schema';

@Processor('alerts')
export class AlertsProcessor {
  private readonly logger = new Logger(AlertsProcessor.name);

  constructor(
    @InjectModel(Alert.name)
    private readonly alertModel: Model<AlertDocument>,
  ) {}

  @Process('process-alert')
  async handleAlert(job: Job) {
    this.logger.warn(`🔔 Processing alert job #${job.id}`);

    // job.data = the payload i passed when adding the job in sensors.service.ts
    const {
      sensorId,
      pipelineId,
      type,
      value,
      unit,
      location,
      alertLevel,
      timestamp,
    } = job.data;

    this.logger.warn(
      `🚨 ALERT [${alertLevel}] | Sensor: ${sensorId} | ${type}: ${value}${unit} | Location: ${location}`,
    );

    // Save alert to MongoDB
    // This creates a permanent audit log of every alert

    const alert = await this.alertModel.create({
      sensorId,
      pipelineId,
      type,
      value,
      unit,
      location,
      alertLevel,
      timestamp: new Date(timestamp),

      jobId: job.id.toString(),
      status: 'processed',
    });

    this.logger.warn(`✅ Alert saved to DB with ID: ${alert._id}`);

    // Return value is stored in job.returnvalue in BullMQ
    return { alertId: alert._id, status: 'processed' };
  }

  // @OnQueueCompleted
  // Lifecycle hook — called every time ANY job in this queue completes
  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(
      `✅ Job #${job.id} completed | Result: ${JSON.stringify(result)}`,
    );
  }

  // @OnQueueFailed
  // Called when a job fails ALL retry attempts
  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `❌ Job #${job.id} failed after ${job.attemptsMade} attempts | Error: ${error.message}`,
    );
  }
}
