import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class ComponentUpdateInputDto {
  @IsString()
  componentKey: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
