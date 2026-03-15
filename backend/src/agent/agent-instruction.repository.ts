import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AgentInstructionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<string> {
    const row = await this.prisma.agentInstruction.findUnique({
      where: { userId },
    });
    return row?.instruction ?? '';
  }

  async set(userId: string, instruction: string): Promise<string> {
    await this.prisma.agentInstruction.upsert({
      where: { userId },
      create: { userId, instruction },
      update: { instruction },
    });
    return instruction;
  }
}
