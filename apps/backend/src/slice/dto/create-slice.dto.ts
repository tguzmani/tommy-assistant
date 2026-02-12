import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsObject,
  IsEnum,
  Min,
} from 'class-validator';

export enum SequenceType {
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  SQRT = 'sqrt',
  LOGARITHMIC = 'logarithmic',
  SIGMOID = 'sigmoid',
}

export enum TemporalType {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  CONTINUOUS = 'continuous',
}

export class CreateSliceDto {
  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(SequenceType)
  increaseType: string;

  @IsOptional()
  @IsObject()
  increaseParams?: Record<string, any>;

  @IsEnum(SequenceType)
  decreaseType: string;

  @IsOptional()
  @IsObject()
  decreaseParams?: Record<string, any>;

  @IsOptional()
  @IsEnum(TemporalType)
  temporalType?: string;

  @IsOptional()
  @IsString()
  expectedTime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  gracePeriod?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  penaltyInterval?: number;

  @IsOptional()
  @IsInt()
  penaltyAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxInterval?: number;

  @IsOptional()
  @IsBoolean()
  resetDaily?: boolean;

  @IsOptional()
  @IsBoolean()
  isComposite?: boolean;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
