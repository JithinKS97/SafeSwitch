import { IsEnum } from 'class-validator';
import { RiskAppetite } from '../../common/types/enums';

export class GetSuggestionsDto {
  @IsEnum(RiskAppetite)
  riskAppetite: RiskAppetite;
}
