/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

import { SensorType } from '../schemas/sensor-reading.schema';

export class CreateSensorReadingDto {
  @IsString()
  sensorId: string;
  // e.g. "SENSOR-TX-001"
  // @IsString() rejects requests where sensorId is a number or missing

  @IsString()
  pipelineId: string;
  // e.g. "PIPELINE-GULF-COAST-A"

  @IsEnum(SensorType)
  type: SensorType;
  // Must be one of: PRESSURE, TEMPERATURE, FLOW_RATE, VIBRATION, GAS_LEVEL
  // @IsEnum() rejects anything else — typos included

  @IsNumber()
  value: number;
  // The actual sensor reading — e.g. 2450.5

  @IsString()
  unit: string;
  // e.g. "PSI", "°F", "bbl/hr"

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;
  // GPS latitude — must be between -90 and 90 (real coordinates only)

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
  // GPS longitude — must be between -180 and 180

  @IsString()
  location: string;
  // e.g. "Gulf Coast Segment A — Mile Marker 47"

  @IsOptional() // threshold is not required — sensor may not have one set
  @IsNumber()
  threshold?: number;
  // Optional fields in DTOs always get @IsOptional() first

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
  // Is the sensor currently active? Defaults to true in the schema

  @IsOptional()
  @IsString()
  operatorId?: string;
  // Keycloak user ID — i'll populate this from the JWT token automatically
  // so it's optional here (the controller will inject it from the token)
}
