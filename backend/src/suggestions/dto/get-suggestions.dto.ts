import { IsInt, Max, Min } from 'class-validator';

export class GetSuggestionsDto {
  @IsInt()
  @Min(0)
  @Max(10)
  riskPct: number;
}
