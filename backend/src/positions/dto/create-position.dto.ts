import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { RiskAppetite, TradeDirection } from '../../common/types/enums';

export class CreatePositionDto {
  @IsString()
  @IsNotEmpty()
  pair: string;

  @IsEnum(TradeDirection)
  direction: TradeDirection;

  @IsEnum(RiskAppetite)
  riskAppetite: RiskAppetite;

  @IsNumber()
  @Min(0)
  amount: number;
}
