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
    // Register our SensorReading schema with Mongoose
    // This creates a MongoDB "model" — an object with methods like
    // .find(), .create(), .findById(), .updateOne() etc.
    // The string 'SensorReading' becomes the collection name: 'sensorreadings'
    // MongoDB automatically lowercases and pluralizes it
    MongooseModule.forFeature([
      { name: SensorReading.name, schema: SensorReadingSchema },
    ]),

    // BullMQ Queue
    // Register a queue named 'alerts'
    // When a sensor reading exceeds its threshold, i'll add a job to this queue
    // A separate worker (processor) will pick it up and handle it asynchronously
    // "Asynchronously" = in the background, without blocking the main request
    BullModule.registerQueue({
      name: 'alerts', // This name is how i reference the queue throughout the app
    }),
  ],

  controllers: [SensorsController],
  // handle incoming HTTP requests

  providers: [SensorsService],

  exports: [SensorsService],
})
export class SensorsModule {}
