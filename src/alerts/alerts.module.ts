import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MongooseModule } from '@nestjs/mongoose';
import { AlertsProcessor } from './alerts.processor';
import { Alert, AlertSchema } from './schemas/alert.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Alert.name, schema: AlertSchema }]),

    BullModule.registerQueue({
      name: 'alerts',
    }),
  ],

  providers: [AlertsProcessor],
})
export class AlertsModule {}
