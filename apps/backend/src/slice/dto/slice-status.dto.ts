export class ComponentStatusDto {
  key: string;
  name: string;
  currentValue: number;
  maxValue: number;
  lastChecked?: Date;
  weight: number;
}

export class SliceStatusDto {
  id: string;
  slug: string;
  name: string;
  description?: string;
  currentValue: number;
  currentIndex: number;
  isComposite: boolean;
  components?: ComponentStatusDto[];
  lastUpdate?: Date;
  nextPenaltyTime?: Date;
  temporalType?: string;
}
