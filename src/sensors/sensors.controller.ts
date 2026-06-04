/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// import { Controller } from '@nestjs/common';

// @Controller('sensors')
// export class SensorsController {}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { SensorsService } from './sensors.service';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';
import { AlertLevel } from './schemas/sensor-reading.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sensors')
export class SensorsController {

  // Dependency Injection — NestJS provides the SensorsService instance
  constructor(private readonly sensorsService: SensorsService) {}

  // ─────────────────────────────────────────────────────────
  // POST /sensors
  // Creates a new sensor reading
  // Protected by JWT auth — requires a valid Keycloak token
  // ─────────────────────────────────────────────────────────
  @Post()
  @UseGuards(JwtAuthGuard)
  // @UseGuards() — before this route runs, run JwtAuthGuard first
  // If the token is invalid/missing → 401 Unauthorized, route never executes
  // If valid → req.user is populated with the decoded token payload
  @HttpCode(HttpStatus.CREATED)
  // Sets response status to 201 Created bcz without this, NestJS defaults to 200 OK
  async createReading(
    @Body() dto: CreateSensorReadingDto,

    @Request() req: any,
  ) {
    dto.operatorId = req.user.sub;

    return this.sensorsService.createReading(dto);
  }

  // ─────────────────────────────────────────────────────────
  // GET /sensors
  // Returns a paginated list of sensor readings
  // Supports optional query filters
  // e.g. GET /sensors?pipelineId=PIPELINE-A&alertLevel=CRITICAL&limit=20
  // ─────────────────────────────────────────────────────────
  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllReadings(
    @Query('pipelineId') pipelineId?: string,
    // @Query('pipelineId') extracts ?pipelineId=... from the URL
    // The ? makes it optional — route works without it too

    @Query('alertLevel') alertLevel?: AlertLevel,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ) {
    return this.sensorsService.getAllReadings({
      pipelineId,
      alertLevel,
      limit: limit ? Number(limit) : 50,
      // Query params come in as strings, so we convert to Number
      // Number('20') → 20
      skip: skip ? Number(skip) : 0,
    });
  }

  // ─────────────────────────────────────────────────────────
  // GET /sensors/:sensorId/latest
  // Returns the latest reading for a specific sensor
  // Hits Redis first, then falls back to MongoDB
  // ─────────────────────────────────────────────────────────
  @Get(':sensorId/latest')
  @UseGuards(JwtAuthGuard)
  async getLatestReading(@Param('sensorId') sensorId: string) {
    // @Param('sensorId') extracts the :sensorId part from the URL
    // GET /sensors/SENSOR-TX-001/latest → sensorId = 'SENSOR-TX-001'
    return this.sensorsService.getLatestReading(sensorId);
  }

  // ─────────────────────────────────────────────────────────
  // GET /sensors/pipeline/:pipelineId/summary
  // Returns an aggregated summary of all sensors on a pipeline
  // Used by the dashboard overview cards
  // ─────────────────────────────────────────────────────────
  @Get('pipeline/:pipelineId/summary')
  @UseGuards(JwtAuthGuard)
  async getPipelineSummary(@Param('pipelineId') pipelineId: string) {
    return this.sensorsService.getPipelineSummary(pipelineId);
  }

  // ─────────────────────────────────────────────────────────
  // GET /sensors/health
  // Public route — no auth required
  // Returns app status — useful for monitoring and load balancers
  // This is the first route you'd check if something seems wrong
  // ─────────────────────────────────────────────────────────
  @Get('health')
  @HttpCode(HttpStatus.OK)
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Pipeline Monitor API',
    };
  }
}
