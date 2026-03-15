import { Controller, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { UserId } from '../common/auth/user-id.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('user')
export class UserController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Delete all data for the current user (positions, suggestion history, agent journal, pair journals).
   * For testing — use with caution.
   */
  @Delete('data')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearAllData(@UserId() userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.position.deleteMany({ where: { userId } }),
      this.prisma.suggestionSnapshot.deleteMany({ where: { userId } }),
      this.prisma.agentJournal.deleteMany({ where: { userId } }),
      this.prisma.pairJournal.deleteMany({ where: { userId } }),
    ]);
  }
}
