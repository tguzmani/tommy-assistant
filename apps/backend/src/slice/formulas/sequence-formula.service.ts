import { Injectable, Logger } from '@nestjs/common';

export interface SliceSequenceConfig {
  type: 'linear' | 'exponential' | 'sqrt' | 'logarithmic' | 'sigmoid';
  params?: {
    multiplier?: number;
    base?: number;
    offset?: number;
    max?: number;
    k?: number;
    inflection?: number;
  };
}

/**
 * Service responsible for calculating sequence values using mathematical formulas.
 * Supports: linear, exponential, square root, logarithmic, and sigmoid sequences.
 */
@Injectable()
export class SequenceFormulaService {
  private readonly logger = new Logger(SequenceFormulaService.name);

  /**
   * Calculate value at index n using closed-form formula.
   * @param config - Sequence configuration with type and parameters
   * @param index - The position in the sequence (0-indexed)
   * @returns The calculated value at the given index
   */
  calculateValue(config: SliceSequenceConfig, index: number): number {
    if (index < 0) {
      this.logger.warn(`Negative index ${index} provided, clamping to 0`);
      index = 0;
    }

    const { type, params = {} } = config;

    try {
      let value: number;

      switch (type) {
        case 'linear':
          value = this.calculateLinear(index, params);
          break;

        case 'exponential':
          value = this.calculateExponential(index, params);
          break;

        case 'sqrt':
          value = this.calculateSqrt(index, params);
          break;

        case 'logarithmic':
          value = this.calculateLogarithmic(index, params);
          break;

        case 'sigmoid':
          value = this.calculateSigmoid(index, params);
          break;

        default:
          throw new Error(`Unknown sequence type: ${type}`);
      }

      return Math.floor(value);
    } catch (error) {
      this.logger.error(
        `Error calculating value for type ${type} at index ${index}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Find closest index to target value using binary search.
   * Used for percentage updates where we need to find the index that gives a specific value.
   * @param config - Sequence configuration
   * @param targetValue - The value to find the closest index for
   * @param maxIndex - Maximum index to search (defaults to 1000)
   * @returns The index that produces the closest value to the target
   */
  findClosestIndex(
    config: SliceSequenceConfig,
    targetValue: number,
    maxIndex: number = 1000,
  ): number {
    if (targetValue <= 0) {
      return 0;
    }

    // For monotonic sequences, use binary search
    if (this.isMonotonicIncreasing(config)) {
      return this.binarySearchIndex(config, targetValue, 0, maxIndex);
    }

    // For non-monotonic sequences, use linear search
    return this.linearSearchIndex(config, targetValue, maxIndex);
  }

  /**
   * Linear sequence: f(n) = a*n + b
   */
  private calculateLinear(
    index: number,
    params: SliceSequenceConfig['params'],
  ): number {
    const multiplier = params?.multiplier ?? 1;
    const offset = params?.offset ?? 0;
    return multiplier * index + offset;
  }

  /**
   * Exponential sequence: f(n) = base^n
   */
  private calculateExponential(
    index: number,
    params: SliceSequenceConfig['params'],
  ): number {
    const base = params?.base ?? 2;
    if (base <= 0) {
      throw new Error('Exponential base must be positive');
    }
    return Math.pow(base, index);
  }

  /**
   * Square root sequence: f(n) = multiplier * √n + offset
   */
  private calculateSqrt(
    index: number,
    params: SliceSequenceConfig['params'],
  ): number {
    const multiplier = params?.multiplier ?? 1;
    const offset = params?.offset ?? 0;
    return multiplier * Math.sqrt(index) + offset;
  }

  /**
   * Logarithmic sequence: f(n) = a * log(n+1) + offset
   */
  private calculateLogarithmic(
    index: number,
    params: SliceSequenceConfig['params'],
  ): number {
    const multiplier = params?.multiplier ?? 10;
    const offset = params?.offset ?? 0;
    return multiplier * Math.log(index + 1) + offset;
  }

  /**
   * Sigmoid sequence: f(n) = max / (1 + e^(-k*(n-inflection)))
   */
  private calculateSigmoid(
    index: number,
    params: SliceSequenceConfig['params'],
  ): number {
    const max = params?.max ?? 100;
    const k = params?.k ?? 0.2;
    const inflection = params?.inflection ?? 15;
    return max / (1 + Math.exp(-k * (index - inflection)));
  }

  /**
   * Check if sequence is monotonically increasing (for optimization).
   */
  private isMonotonicIncreasing(config: SliceSequenceConfig): boolean {
    const { type, params = {} } = config;

    switch (type) {
      case 'linear':
        return (params.multiplier ?? 1) >= 0;
      case 'exponential':
        return (params.base ?? 2) >= 1;
      case 'sqrt':
        return (params.multiplier ?? 1) >= 0;
      case 'logarithmic':
        return (params.multiplier ?? 10) >= 0;
      case 'sigmoid':
        return true;
      default:
        return false;
    }
  }

  /**
   * Binary search for the closest index (for monotonic sequences).
   */
  private binarySearchIndex(
    config: SliceSequenceConfig,
    targetValue: number,
    minIndex: number,
    maxIndex: number,
  ): number {
    let left = minIndex;
    let right = maxIndex;
    let closestIndex = left;
    let closestDiff = Math.abs(
      this.calculateValue(config, left) - targetValue,
    );

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midValue = this.calculateValue(config, mid);
      const diff = Math.abs(midValue - targetValue);

      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = mid;
      }

      if (midValue < targetValue) {
        left = mid + 1;
      } else if (midValue > targetValue) {
        right = mid - 1;
      } else {
        return mid;
      }
    }

    return closestIndex;
  }

  /**
   * Linear search for the closest index (for non-monotonic sequences).
   */
  private linearSearchIndex(
    config: SliceSequenceConfig,
    targetValue: number,
    maxIndex: number,
  ): number {
    let closestIndex = 0;
    let closestDiff = Math.abs(
      this.calculateValue(config, 0) - targetValue,
    );

    for (let i = 1; i <= maxIndex; i++) {
      const value = this.calculateValue(config, i);
      const diff = Math.abs(value - targetValue);

      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = i;
      }
    }

    return closestIndex;
  }
}
