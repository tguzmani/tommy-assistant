import { IsInt, IsString, IsOptional, IsEnum } from 'class-validator';

export enum SliceUpdateType {
  STEPS = 'steps',
  PERCENTAGE = 'percentage',
  ABSOLUTE = 'absolute',
}

export class SliceUpdateInputDto {
  @IsEnum(SliceUpdateType)
  type: SliceUpdateType;

  @IsInt()
  value: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
