import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Document } from 'mongoose';

// SensorType Enum
export enum SensorType {
  PRESSURE = 'PRESSURE', // Measures pipeline pressure (PSI)
  TEMPERATURE = 'TEMPERATURE', // Measures fluid/gas temperature (°F or °C)
  FLOW_RATE = 'FLOW_RATE', // Measures how fast fluid is moving (barrels/hour)
  VIBRATION = 'VIBRATION', // Detects abnormal vibration in equipment
  GAS_LEVEL = 'GAS_LEVEL', // Detects gas concentration (safety critical)
}

export enum AlertLevel {
  NORMAL = 'NORMAL', // Everything is fine
  WARNING = 'WARNING', // Getting close to danger threshold — watch it
  CRITICAL = 'CRITICAL', // Exceeded safe limits — action required immediately
}

@Schema({ timestamps: true })
export class SensorReading {

  @Prop({ required: true })
  sensorId: string;
  // Unique ID of the physical sensor device
  // e.g. "SENSOR-TX-001" (TX = Texas pipeline)

  @Prop({ required: true })
  pipelineId: string;
  // Which pipeline this sensor belongs to
  // e.g. "PIPELINE-GULF-COAST-A"

  @Prop({ required: true, enum: SensorType })
  // enum: SensorType → MongoDB will REJECT any value not in the enum
  // This is validation at the database level, not just the app level
  type: SensorType;

  @Prop({ required: true })
  value: number;
  // The actual reading — what number did the sensor report?
  // e.g. 2450 (PSI), 185.3 (°F), 12500 (barrels/hour)

  @Prop({ required: true })
  unit: string;
  // The unit for the value above
  // e.g. "PSI", "°F", "bbl/hr", "mm/s", "ppm"

  @Prop({ required: true, min: -90, max: 90 })
  latitude: number;
  // GPS latitude of the sensor
  // min/max validates it's a real coordinate

  @Prop({ required: true, min: -180, max: 180 })
  longitude: number;
  // GPS longitude of the sensor

  @Prop({ required: true })
  location: string;
  // Human-readable location name
  // e.g. "Gulf Coast Segment A — Mile Marker 47"

  @Prop({ required: true, enum: AlertLevel, default: AlertLevel.NORMAL })
  // default: AlertLevel.NORMAL → if not specified, assume everything is fine
  alertLevel: AlertLevel;

  @Prop()
  threshold: number;
  // The maximum safe value for this sensor type
  // If value > threshold → trigger an alert via our queue (BullMQ)

  @Prop({ default: true })
  isActive: boolean;
  // Is this sensor currently online and reporting?
  // false = sensor is offline or in maintenance

  @Prop()
  operatorId: string;
  // The Keycloak user ID of the operator responsible for this sensor
  // This links  OIDC auth system to our data
}

export const SensorReadingSchema = SchemaFactory.createForClass(SensorReading);

export type SensorReadingDocument = SensorReading & Document;
