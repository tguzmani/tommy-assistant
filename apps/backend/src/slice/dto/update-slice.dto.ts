import { PartialType } from '@nestjs/mapped-types';
import { CreateSliceDto } from './create-slice.dto';

export class UpdateSliceDto extends PartialType(CreateSliceDto) {}
