import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  AlertLevel,
  SensorType,
} from '../../sensors/schemas/sensor-reading.schema';

@Schema({ timestamps: true })
export class Alert {
  @Prop({ required: true })
  sensorId: string;

  @Prop({ required: true })
  pipelineId: string;

  @Prop({ required: true, enum: SensorType })
  type: SensorType;
  // What kind of reading triggered this alert? (PRESSURE, TEMPERATURE etc.)

  @Prop({ required: true })
  value: number;
  // The actual reading value that triggered the alert

  @Prop({ required: true })
  unit: string;

  @Prop({ required: true })
  location: string;

  @Prop({ required: true, enum: AlertLevel })
  alertLevel: AlertLevel;
  // WARNING or CRITICAL

  @Prop({ required: true })
  timestamp: Date;
  // When the sensor reading was taken — not when the job was processed
  // These can differ if the queue is backlogged

  @Prop()
  jobId: string;
  // The BullMQ job ID — links this alert record to the queue job

  @Prop({ default: 'processed' })
  status: string;
  // Alert lifecycle: like 'processed' | 'acknowledged' | 'resolved'

  @Prop()
  acknowledgedBy?: string;
  // Keycloak user ID of whoever acknowledged this alert
  // Links back to OIDC auth system

  @Prop()
  resolvedAt?: Date;
}

export const AlertSchema = SchemaFactory.createForClass(Alert);

AlertSchema.index({ pipelineId: 1, alertLevel: 1, timestamp: -1 });

export type AlertDocument = Alert & Document;
