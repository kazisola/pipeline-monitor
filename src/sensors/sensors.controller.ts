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
  constructor(private readonly sensorsService: SensorsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  // Sets response status to 201 Created bcz without this, NestJS defaults to 200 OK
  async createReading(
    @Body() dto: CreateSensorReadingDto,

    @Request() req: any,
  ) {
    dto.operatorId = req.user.sub;

    return this.sensorsService.createReading(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllReadings(
    @Query('pipelineId') pipelineId?: string,

    @Query('alertLevel') alertLevel?: AlertLevel,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ) {
    return this.sensorsService.getAllReadings({
      pipelineId,
      alertLevel,
      limit: limit ? Number(limit) : 50,
      // Query params come in as strings, so we convert to Number
      // Number('20') > 20
      skip: skip ? Number(skip) : 0,
    });
  }

  @Get(':sensorId/latest')
  @UseGuards(JwtAuthGuard)
  async getLatestReading(@Param('sensorId') sensorId: string) {
    // @Param('sensorId') extracts the :sensorId part from the URL
    // GET /sensors/SENSOR-TX-001/latest > sensorId = 'SENSOR-TX-001'
    return this.sensorsService.getLatestReading(sensorId);
  }

  @Get('pipeline/:pipelineId/summary')
  @UseGuards(JwtAuthGuard)
  async getPipelineSummary(@Param('pipelineId') pipelineId: string) {
    return this.sensorsService.getPipelineSummary(pipelineId);
  }

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
