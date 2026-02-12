import { Test, TestingModule } from '@nestjs/testing';
import {
  SequenceFormulaService,
  SliceSequenceConfig,
} from './sequence-formula.service';

describe('SequenceFormulaService', () => {
  let service: SequenceFormulaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequenceFormulaService],
    }).compile();

    service = module.get<SequenceFormulaService>(SequenceFormulaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateValue', () => {
    describe('linear sequences', () => {
      it('should calculate linear sequence with multiplier 1', () => {
        const config: SliceSequenceConfig = {
          type: 'linear',
          params: { multiplier: 1 },
        };

        expect(service.calculateValue(config, 0)).toBe(0);
        expect(service.calculateValue(config, 1)).toBe(1);
        expect(service.calculateValue(config, 5)).toBe(5);
        expect(service.calculateValue(config, 10)).toBe(10);
      });

      it('should calculate linear sequence with multiplier 5', () => {
        const config: SliceSequenceConfig = {
          type: 'linear',
          params: { multiplier: 5 },
        };

        expect(service.calculateValue(config, 0)).toBe(0);
        expect(service.calculateValue(config, 1)).toBe(5);
        expect(service.calculateValue(config, 2)).toBe(10);
        expect(service.calculateValue(config, 10)).toBe(50);
      });

      it('should calculate linear sequence with offset', () => {
        const config: SliceSequenceConfig = {
          type: 'linear',
          params: { multiplier: 2, offset: 10 },
        };

        expect(service.calculateValue(config, 0)).toBe(10);
        expect(service.calculateValue(config, 1)).toBe(12);
        expect(service.calculateValue(config, 5)).toBe(20);
      });
    });

    describe('exponential sequences', () => {
      it('should calculate exponential sequence with base 2', () => {
        const config: SliceSequenceConfig = {
          type: 'exponential',
          params: { base: 2 },
        };

        expect(service.calculateValue(config, 0)).toBe(1);
        expect(service.calculateValue(config, 1)).toBe(2);
        expect(service.calculateValue(config, 2)).toBe(4);
        expect(service.calculateValue(config, 3)).toBe(8);
        expect(service.calculateValue(config, 10)).toBe(1024);
      });

      it('should calculate exponential sequence with base 1.15 (gym)', () => {
        const config: SliceSequenceConfig = {
          type: 'exponential',
          params: { base: 1.15 },
        };

        expect(service.calculateValue(config, 0)).toBe(1);
        expect(service.calculateValue(config, 1)).toBe(1); // floor(1.15)
        expect(service.calculateValue(config, 2)).toBe(1); // floor(1.3225)
        expect(service.calculateValue(config, 3)).toBe(1); // floor(1.520875)
        expect(service.calculateValue(config, 4)).toBe(1); // floor(1.749...)
        expect(service.calculateValue(config, 5)).toBe(2); // floor(2.011...)
      });
    });

    describe('sqrt sequences', () => {
      it('should calculate sqrt sequence', () => {
        const config: SliceSequenceConfig = {
          type: 'sqrt',
          params: { multiplier: 1 },
        };

        expect(service.calculateValue(config, 0)).toBe(0);
        expect(service.calculateValue(config, 1)).toBe(1);
        expect(service.calculateValue(config, 4)).toBe(2);
        expect(service.calculateValue(config, 9)).toBe(3);
        expect(service.calculateValue(config, 16)).toBe(4);
      });

      it('should calculate sqrt sequence with multiplier', () => {
        const config: SliceSequenceConfig = {
          type: 'sqrt',
          params: { multiplier: 2 },
        };

        expect(service.calculateValue(config, 0)).toBe(0);
        expect(service.calculateValue(config, 1)).toBe(2);
        expect(service.calculateValue(config, 4)).toBe(4);
        expect(service.calculateValue(config, 9)).toBe(6);
      });
    });

    describe('logarithmic sequences', () => {
      it('should calculate logarithmic sequence', () => {
        const config: SliceSequenceConfig = {
          type: 'logarithmic',
          params: { multiplier: 10 },
        };

        expect(service.calculateValue(config, 0)).toBe(0);
        expect(service.calculateValue(config, 1)).toBeGreaterThan(6); // ~6.9
        expect(service.calculateValue(config, 2)).toBeGreaterThan(10); // ~10.9
        expect(service.calculateValue(config, 9)).toBeGreaterThan(23); // ~23
      });
    });

    describe('sigmoid sequences', () => {
      it('should calculate sigmoid sequence', () => {
        const config: SliceSequenceConfig = {
          type: 'sigmoid',
          params: { max: 100, k: 0.2, inflection: 15 },
        };

        const value0 = service.calculateValue(config, 0);
        const value15 = service.calculateValue(config, 15);
        const value30 = service.calculateValue(config, 30);

        expect(value0).toBeLessThan(10); // Should be low at start
        expect(value15).toBeGreaterThan(40); // Should be ~50 at inflection
        expect(value15).toBeLessThan(60);
        expect(value30).toBeGreaterThan(90); // Should approach 100
      });
    });

    describe('edge cases', () => {
      it('should handle negative indices', () => {
        const config: SliceSequenceConfig = {
          type: 'linear',
          params: { multiplier: 1 },
        };

        expect(service.calculateValue(config, -5)).toBe(0); // Should clamp to 0
      });

      it('should floor decimal results', () => {
        const config: SliceSequenceConfig = {
          type: 'linear',
          params: { multiplier: 1.5 },
        };

        expect(service.calculateValue(config, 1)).toBe(1); // floor(1.5)
        expect(service.calculateValue(config, 2)).toBe(3); // floor(3.0)
        expect(service.calculateValue(config, 3)).toBe(4); // floor(4.5)
      });
    });
  });

  describe('findClosestIndex', () => {
    it('should find closest index for linear sequence', () => {
      const config: SliceSequenceConfig = {
        type: 'linear',
        params: { multiplier: 5 },
      };

      expect(service.findClosestIndex(config, 0)).toBe(0);
      expect(service.findClosestIndex(config, 5)).toBe(1);
      expect(service.findClosestIndex(config, 10)).toBe(2);
      expect(service.findClosestIndex(config, 50)).toBe(10);
    });

    it('should find closest index for exponential sequence', () => {
      const config: SliceSequenceConfig = {
        type: 'exponential',
        params: { base: 2 },
      };

      expect(service.findClosestIndex(config, 1)).toBe(0);
      expect(service.findClosestIndex(config, 2)).toBe(1);
      expect(service.findClosestIndex(config, 4)).toBe(2);
      expect(service.findClosestIndex(config, 8)).toBe(3);
      expect(service.findClosestIndex(config, 16)).toBe(4);
    });

    it('should find closest index when exact match not possible', () => {
      const config: SliceSequenceConfig = {
        type: 'linear',
        params: { multiplier: 5 },
      };

      // Target 7 should be closest to index 1 (value 5) or 2 (value 10)
      const index = service.findClosestIndex(config, 7);
      expect(index).toBeGreaterThanOrEqual(1);
      expect(index).toBeLessThanOrEqual(2);
    });

    it('should handle target value of 0', () => {
      const config: SliceSequenceConfig = {
        type: 'linear',
        params: { multiplier: 5 },
      };

      expect(service.findClosestIndex(config, 0)).toBe(0);
    });
  });
});
