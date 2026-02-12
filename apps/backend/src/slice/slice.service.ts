import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SequenceFormulaService,
  SliceSequenceConfig,
} from './formulas/sequence-formula.service';
import { CreateSliceDto } from './dto/create-slice.dto';
import { UpdateSliceDto } from './dto/update-slice.dto';
import { SliceStatusDto, ComponentStatusDto } from './dto/slice-status.dto';
import { Slice, SliceUpdate, Prisma } from '@prisma/client';

type SliceWithRelations = Prisma.SliceGetPayload<{
  include: { components: true; updates: true };
}>;

/**
 * Main service for managing slices and their updates.
 * Handles step-based, percentage-based, and absolute value updates.
 */
@Injectable()
export class SliceService {
  private readonly logger = new Logger(SliceService.name);
  private readonly MAX_INDEX = 10000; // Safety limit

  constructor(
    private readonly prisma: PrismaService,
    private readonly formulaService: SequenceFormulaService,
  ) {}

  /**
   * Create a new slice.
   */
  async create(createSliceDto: CreateSliceDto): Promise<Slice> {
    return this.prisma.slice.create({
      data: {
        ...createSliceDto,
        increaseParams: createSliceDto.increaseParams || {},
        decreaseParams: createSliceDto.decreaseParams || {},
      },
    });
  }

  /**
   * Find all slices.
   */
  async findAll(): Promise<Slice[]> {
    return this.prisma.slice.findMany({
      include: {
        components: true,
        category: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Find a slice by ID.
   */
  async findOne(id: string): Promise<SliceWithRelations> {
    const slice = await this.prisma.slice.findUnique({
      where: { id },
      include: {
        components: true,
        updates: {
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });

    if (!slice) {
      throw new NotFoundException(`Slice with ID ${id} not found`);
    }

    return slice;
  }

  /**
   * Find a slice by slug.
   */
  async findBySlug(slug: string): Promise<SliceWithRelations> {
    const slice = await this.prisma.slice.findUnique({
      where: { slug },
      include: {
        components: true,
        updates: {
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });

    if (!slice) {
      throw new NotFoundException(`Slice with slug ${slug} not found`);
    }

    return slice;
  }

  /**
   * Update a slice.
   */
  async update(id: string, updateSliceDto: UpdateSliceDto): Promise<Slice> {
    return this.prisma.slice.update({
      where: { id },
      data: updateSliceDto,
    });
  }

  /**
   * Delete a slice.
   */
  async remove(id: string): Promise<Slice> {
    return this.prisma.slice.delete({
      where: { id },
    });
  }

  /**
   * Update slice by steps (+1, -5, etc.).
   * @param sliceId - The ID of the slice
   * @param steps - Number of steps to move (can be negative)
   * @param notes - Optional notes
   * @param automatic - Whether this is an automatic penalty
   */
  async updateBySteps(
    sliceId: string,
    steps: number,
    notes?: string,
    automatic = false,
  ): Promise<SliceWithRelations> {
    const slice = await this.findOne(sliceId);

    if (slice.isComposite) {
      throw new BadRequestException(
        'Cannot update composite slices with steps. Use component updates instead.',
      );
    }

    const oldIndex = slice.currentIndex;
    const oldValue = slice.currentValue;

    // Calculate new index
    let newIndex = oldIndex + steps;

    // Clamp to valid range
    newIndex = Math.max(0, Math.min(newIndex, this.MAX_INDEX));

    // Determine which sequence to use
    const isIncrease = steps >= 0;
    const config: SliceSequenceConfig = {
      type: (isIncrease ? slice.increaseType : slice.decreaseType) as SliceSequenceConfig['type'],
      params: isIncrease
        ? (slice.increaseParams as any)
        : (slice.decreaseParams as any),
    };

    // Calculate new value
    const newValue = this.formulaService.calculateValue(config, newIndex);

    // Create update record
    await this.prisma.sliceUpdate.create({
      data: {
        sliceId,
        delta: steps,
        deltaType: 'steps',
        valueBefore: oldValue,
        valueAfter: newValue,
        indexBefore: oldIndex,
        indexAfter: newIndex,
        notes,
        automatic,
      },
    });

    // Update slice
    const updatedSlice = await this.prisma.slice.update({
      where: { id: sliceId },
      data: {
        currentIndex: newIndex,
        currentValue: newValue,
      },
      include: {
        components: true,
        updates: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    this.logger.log(
      `Updated slice ${slice.slug}: ${oldValue} → ${newValue} (index ${oldIndex} → ${newIndex}, steps: ${steps})`,
    );

    return updatedSlice;
  }

  /**
   * Update slice by percentage (-90%, +50%, etc.).
   * @param sliceId - The ID of the slice
   * @param percentage - Percentage change (e.g., -90 for -90%, 50 for +50%)
   * @param notes - Optional notes
   */
  async updateByPercentage(
    sliceId: string,
    percentage: number,
    notes?: string,
  ): Promise<SliceWithRelations> {
    const slice = await this.findOne(sliceId);

    if (slice.isComposite) {
      throw new BadRequestException(
        'Cannot update composite slices with percentage. Use component updates instead.',
      );
    }

    const oldIndex = slice.currentIndex;
    const oldValue = slice.currentValue;

    // Calculate target value
    const targetValue = Math.max(
      0,
      Math.floor(oldValue * (1 + percentage / 100)),
    );

    // Determine which sequence to use based on direction
    const isIncrease = percentage >= 0;
    const config: SliceSequenceConfig = {
      type: (isIncrease ? slice.increaseType : slice.decreaseType) as SliceSequenceConfig['type'],
      params: isIncrease
        ? (slice.increaseParams as any)
        : (slice.decreaseParams as any),
    };

    // Find closest index for target value
    const newIndex = this.formulaService.findClosestIndex(
      config,
      targetValue,
      this.MAX_INDEX,
    );

    // Calculate actual new value
    const newValue = this.formulaService.calculateValue(config, newIndex);

    // Create update record
    await this.prisma.sliceUpdate.create({
      data: {
        sliceId,
        delta: percentage,
        deltaType: 'percentage',
        valueBefore: oldValue,
        valueAfter: newValue,
        indexBefore: oldIndex,
        indexAfter: newIndex,
        notes,
        automatic: false,
      },
    });

    // Update slice
    const updatedSlice = await this.prisma.slice.update({
      where: { id: sliceId },
      data: {
        currentIndex: newIndex,
        currentValue: newValue,
      },
      include: {
        components: true,
        updates: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    this.logger.log(
      `Updated slice ${slice.slug} by ${percentage}%: ${oldValue} → ${newValue} (index ${oldIndex} → ${newIndex})`,
    );

    return updatedSlice;
  }

  /**
   * Set slice to absolute value.
   * @param sliceId - The ID of the slice
   * @param value - The target value
   * @param notes - Optional notes
   */
  async updateToValue(
    sliceId: string,
    value: number,
    notes?: string,
  ): Promise<SliceWithRelations> {
    const slice = await this.findOne(sliceId);

    if (slice.isComposite) {
      throw new BadRequestException(
        'Cannot update composite slices to absolute value. Use component updates instead.',
      );
    }

    const oldIndex = slice.currentIndex;
    const oldValue = slice.currentValue;

    if (value < 0) {
      throw new BadRequestException('Value cannot be negative');
    }

    // Determine which sequence to use based on direction
    const isIncrease = value >= oldValue;
    const config: SliceSequenceConfig = {
      type: (isIncrease ? slice.increaseType : slice.decreaseType) as SliceSequenceConfig['type'],
      params: isIncrease
        ? (slice.increaseParams as any)
        : (slice.decreaseParams as any),
    };

    // Find closest index for target value
    const newIndex = this.formulaService.findClosestIndex(
      config,
      value,
      this.MAX_INDEX,
    );

    // Calculate actual new value
    const newValue = this.formulaService.calculateValue(config, newIndex);

    // Create update record
    await this.prisma.sliceUpdate.create({
      data: {
        sliceId,
        delta: value,
        deltaType: 'absolute',
        valueBefore: oldValue,
        valueAfter: newValue,
        indexBefore: oldIndex,
        indexAfter: newIndex,
        notes,
        automatic: false,
      },
    });

    // Update slice
    const updatedSlice = await this.prisma.slice.update({
      where: { id: sliceId },
      data: {
        currentIndex: newIndex,
        currentValue: newValue,
      },
      include: {
        components: true,
        updates: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    this.logger.log(
      `Set slice ${slice.slug} to ${newValue} (index ${oldIndex} → ${newIndex})`,
    );

    return updatedSlice;
  }

  /**
   * Get current status of a slice.
   */
  async getSliceStatus(slug: string): Promise<SliceStatusDto> {
    const slice = await this.findBySlug(slug);

    const lastUpdate = await this.prisma.sliceUpdate.findFirst({
      where: { sliceId: slice.id },
      orderBy: { date: 'desc' },
    });

    const status: SliceStatusDto = {
      id: slice.id,
      slug: slice.slug,
      name: slice.name,
      description: slice.description,
      currentValue: slice.currentValue,
      currentIndex: slice.currentIndex,
      isComposite: slice.isComposite,
      lastUpdate: lastUpdate?.date,
      temporalType: slice.temporalType,
    };

    if (slice.isComposite && slice.components) {
      status.components = slice.components.map((comp) => ({
        key: comp.key,
        name: comp.name,
        currentValue: comp.currentValue,
        maxValue: comp.maxValue,
        lastChecked: comp.lastChecked,
        weight: comp.weight,
      }));
    }

    return status;
  }

  /**
   * Get all slices with temporal behavior of a specific type.
   */
  async findByTemporalType(temporalType: string): Promise<Slice[]> {
    return this.prisma.slice.findMany({
      where: { temporalType },
      include: {
        updates: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });
  }
}
