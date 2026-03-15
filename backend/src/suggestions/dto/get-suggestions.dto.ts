import { IsInt, Max, Min } from 'class-validator';

export class GetSuggestionsDto {
  @IsInt()
  @Min(0)
  @Max(100)
  riskPct: number;
}
