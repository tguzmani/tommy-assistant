import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Slice, SliceComponent } from '@prisma/client';

/**
 * Service for managing composite slices.
 * Handles component updates, decay calculations, and aggregated value computation.
 */
@Injectable()
export class CompositeSliceService {
  private readonly logger = new Logger(CompositeSliceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate aggregated value from all components.
   * Applies decay to each component based on time elapsed.
   * @param slice - The composite slice with components
   * @returns The weighted average value of all components
   */
  async calculateCompositeValue(slice: Slice): Promise<number> {
    if (!slice.isComposite) {
      throw new BadRequestException('Slice is not a composite slice');
    }

    const components = await this.prisma.sliceComponent.findMany({
      where: { sliceId: slice.id },
    });

    if (components.length === 0) {
      return 0;
    }

    const now = new Date();
    let totalWeight = 0;
    let weightedSum = 0;

    for (const component of components) {
      const decayedValue = this.applyDecay(component, now);
      weightedSum += decayedValue * (component.weight / 100);
      totalWeight += component.weight;
    }

    // Normalize if weights don't sum to 100
    if (totalWeight === 0) {
      return 0;
    }

    const normalizedValue = (weightedSum * 100) / totalWeight;
    return Math.floor(normalizedValue);
  }

  /**
   * Update a specific component of a composite slice.
   * @param sliceId - The ID of the composite slice
   * @param componentKey - The key of the component to update
   * @param value - The new value (defaults to maxValue)
   * @param notes - Optional notes
   */
  async updateComponent(
    sliceId: string,
    componentKey: string,
    value?: number,
    notes?: string,
  ): Promise<Slice> {
    const slice = await this.prisma.slice.findUnique({
      where: { id: sliceId },
      include: { components: true },
    });

    if (!slice) {
      throw new NotFoundException(`Slice with ID ${sliceId} not found`);
    }

    if (!slice.isComposite) {
      throw new BadRequestException('Slice is not a composite slice');
    }

    const component = slice.components.find((c) => c.key === componentKey);

    if (!component) {
      throw new NotFoundException(
        `Component ${componentKey} not found in slice ${slice.slug}`,
      );
    }

    const oldValue = component.currentValue;
    const newValue = value ?? component.maxValue;

    if (newValue < 0 || newValue > component.maxValue) {
      throw new BadRequestException(
        `Value must be between 0 and ${component.maxValue}`,
      );
    }

    // Create component update record
    await this.prisma.sliceComponentUpdate.create({
      data: {
        componentId: component.id,
        valueBefore: oldValue,
        valueAfter: newValue,
        notes,
      },
    });

    // Update component
    await this.prisma.sliceComponent.update({
      where: { id: component.id },
      data: {
        currentValue: newValue,
        lastChecked: new Date(),
      },
    });

    this.logger.log(
      `Updated component ${componentKey} of slice ${slice.slug}: ${oldValue} → ${newValue}`,
    );

    // Recalculate composite value
    const compositeValue = await this.calculateCompositeValue(slice);

    // Update parent slice
    const updatedSlice = await this.prisma.slice.update({
      where: { id: sliceId },
      data: {
        currentValue: compositeValue,
      },
      include: {
        components: true,
      },
    });

    this.logger.log(
      `Recalculated composite value for ${slice.slug}: ${compositeValue}`,
    );

    return updatedSlice;
  }

  /**
   * Update multiple components at once.
   * @param sliceId - The ID of the composite slice
   * @param componentKeys - Array of component keys to update
   * @param notes - Optional notes
   */
  async updateMultipleComponents(
    sliceId: string,
    componentKeys: string[],
    notes?: string,
  ): Promise<Slice> {
    const slice = await this.prisma.slice.findUnique({
      where: { id: sliceId },
      include: { components: true },
    });

    if (!slice) {
      throw new NotFoundException(`Slice with ID ${sliceId} not found`);
    }

    if (!slice.isComposite) {
      throw new BadRequestException('Slice is not a composite slice');
    }

    // Update each component
    for (const key of componentKeys) {
      const component = slice.components.find((c) => c.key === key);

      if (!component) {
        this.logger.warn(
          `Component ${key} not found in slice ${slice.slug}, skipping`,
        );
        continue;
      }

      const oldValue = component.currentValue;
      const newValue = component.maxValue;

      // Create component update record
      await this.prisma.sliceComponentUpdate.create({
        data: {
          componentId: component.id,
          valueBefore: oldValue,
          valueAfter: newValue,
          notes,
        },
      });

      // Update component
      await this.prisma.sliceComponent.update({
        where: { id: component.id },
        data: {
          currentValue: newValue,
          lastChecked: new Date(),
        },
      });

      this.logger.log(
        `Updated component ${key} of slice ${slice.slug}: ${oldValue} → ${newValue}`,
      );
    }

    // Recalculate composite value
    const compositeValue = await this.calculateCompositeValue(slice);

    // Update parent slice
    const updatedSlice = await this.prisma.slice.update({
      where: { id: sliceId },
      data: {
        currentValue: compositeValue,
      },
      include: {
        components: true,
      },
    });

    this.logger.log(
      `Recalculated composite value for ${slice.slug}: ${compositeValue}`,
    );

    return updatedSlice;
  }

  /**
   * Apply decay to a component based on time elapsed since lastChecked.
   * @param component - The component to apply decay to
   * @param now - Current timestamp
   * @returns The decayed value
   */
  private applyDecay(component: SliceComponent, now: Date): number {
    if (!component.lastChecked) {
      // Never checked, assume it's at 0
      return 0;
    }

    const lastChecked = new Date(component.lastChecked);
    const elapsedMs = now.getTime() - lastChecked.getTime();

    let periods = 0;

    switch (component.decayType) {
      case 'hourly':
        periods = elapsedMs / (1000 * 60 * 60); // hours
        break;
      case 'daily':
        periods = elapsedMs / (1000 * 60 * 60 * 24); // days
        break;
      case 'weekly':
        periods = elapsedMs / (1000 * 60 * 60 * 24 * 7); // weeks
        break;
      default:
        this.logger.warn(`Unknown decay type: ${component.decayType}`);
        return component.currentValue;
    }

    // Calculate decay
    const decayAmount = periods * component.decayRate;
    const decayedValue = Math.max(0, component.currentValue - decayAmount);

    return decayedValue;
  }

  /**
   * Recalculate all composite slices (for periodic updates).
   */
  async recalculateAllCompositeSlices(): Promise<void> {
    const compositeSlices = await this.prisma.slice.findMany({
      where: { isComposite: true },
      include: { components: true },
    });

    this.logger.log(
      `Recalculating ${compositeSlices.length} composite slices`,
    );

    for (const slice of compositeSlices) {
      try {
        const compositeValue = await this.calculateCompositeValue(slice);

        await this.prisma.slice.update({
          where: { id: slice.id },
          data: {
            currentValue: compositeValue,
          },
        });

        this.logger.log(
          `Updated composite value for ${slice.slug}: ${compositeValue}`,
        );
      } catch (error) {
        this.logger.error(
          `Error recalculating composite slice ${slice.slug}:`,
          error,
        );
      }
    }
  }

  /**
   * Get detailed component status.
   */
  async getComponentStatus(sliceId: string, componentKey: string) {
    const component = await this.prisma.sliceComponent.findFirst({
      where: {
        sliceId,
        key: componentKey,
      },
      include: {
        updates: {
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });

    if (!component) {
      throw new NotFoundException(
        `Component ${componentKey} not found in slice`,
      );
    }

    const now = new Date();
    const decayedValue = this.applyDecay(component, now);

    return {
      ...component,
      decayedValue,
    };
  }
}
