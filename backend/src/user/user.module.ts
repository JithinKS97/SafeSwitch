import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
})
export class UserModule {}
