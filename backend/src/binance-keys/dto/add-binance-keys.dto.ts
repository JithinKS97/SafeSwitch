import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AddBinanceKeysDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  apiKey: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  apiSecret: string;
}
