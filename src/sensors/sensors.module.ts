// import { Module } from '@nestjs/common';
// import { SensorsController } from './sensors.controller';
// import { SensorsService } from './sensors.service';

// @Module({
//   controllers: [SensorsController],
//   providers: [SensorsService]
// })
// export class SensorsModule {}

import { Module } from '@nestjs/common';

import { MongooseModule } from '@nestjs/mongoose';

import { BullModule } from '@nestjs/bull';

import { SensorsController } from './sensors.controller';
import { SensorsService } from './sensors.service';
import {
  SensorReading,
  SensorReadingSchema,
} from './schemas/sensor-reading.schema';

@Module({
  imports: [
    // MongoDB
    MongooseModule.forFeature([
      { name: SensorReading.name, schema: SensorReadingSchema },
    ]),

    // BullMQ Queue
    BullModule.registerQueue({
      name: 'alerts',
    }),
  ],

  controllers: [SensorsController],
  // handle incoming HTTP requests

  providers: [SensorsService],

  exports: [SensorsService],
})
export class SensorsModule {}
