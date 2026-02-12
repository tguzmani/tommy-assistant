import { Test, TestingModule } from '@nestjs/testing';
import { SliceService } from './slice.service';
import { PrismaService } from '../prisma/prisma.service';
import { SequenceFormulaService } from './formulas/sequence-formula.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('SliceService', () => {
  let service: SliceService;
  let prismaService: PrismaService;
  let formulaService: SequenceFormulaService;

  const mockSlice = {
    id: '1',
    slug: 'gym',
    name: 'Gym',
    description: 'Gym attendance',
    increaseType: 'exponential',
    increaseParams: { base: 1.15 },
    decreaseType: 'exponential',
    decreaseParams: { base: 1.3 },
    currentIndex: 5,
    currentValue: 2,
    temporalType: 'manual',
    expectedTime: null,
    gracePeriod: null,
    penaltyInterval: null,
    penaltyAmount: null,
    maxInterval: null,
    resetDaily: false,
    isComposite: false,
    categoryId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SliceService,
        SequenceFormulaService,
        {
          provide: PrismaService,
          useValue: {
            slice: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            sliceUpdate: {
              create: jest.fn(),
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SliceService>(SliceService);
    prismaService = module.get<PrismaService>(PrismaService);
    formulaService = module.get<SequenceFormulaService>(SequenceFormulaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findBySlug', () => {
    it('should return a slice by slug', async () => {
      jest.spyOn(prismaService.slice, 'findUnique').mockResolvedValue({
        ...mockSlice,
        components: [],
        updates: [],
      });

      const result = await service.findBySlug('gym');
      expect(result).toEqual(expect.objectContaining({ slug: 'gym' }));
      expect(prismaService.slice.findUnique).toHaveBeenCalledWith({
        where: { slug: 'gym' },
        include: {
          components: true,
          updates: {
            orderBy: { date: 'desc' },
            take: 10,
          },
        },
      });
    });

    it('should throw NotFoundException when slice not found', async () => {
      jest.spyOn(prismaService.slice, 'findUnique').mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateBySteps', () => {
    it('should update slice by positive steps', async () => {
      const sliceWithUpdates = {
        ...mockSlice,
        components: [],
        updates: [
          {
            id: 'update-1',
            sliceId: '1',
            delta: 2,
            deltaType: 'steps',
            valueBefore: 2,
            valueAfter: 4,
            indexBefore: 5,
            indexAfter: 7,
            date: new Date(),
            notes: null,
            automatic: false,
            createdAt: new Date(),
          },
        ],
      };

      jest.spyOn(service, 'findOne').mockResolvedValue({
        ...mockSlice,
        components: [],
        updates: [],
      });

      jest.spyOn(prismaService.sliceUpdate, 'create').mockResolvedValue({
        id: 'update-1',
        sliceId: '1',
        delta: 2,
        deltaType: 'steps',
        valueBefore: 2,
        valueAfter: 4,
        indexBefore: 5,
        indexAfter: 7,
        date: new Date(),
        notes: null,
        automatic: false,
        createdAt: new Date(),
      });

      jest
        .spyOn(prismaService.slice, 'update')
        .mockResolvedValue(sliceWithUpdates);

      const result = await service.updateBySteps('1', 2);

      expect(result).toBeDefined();
      expect(prismaService.sliceUpdate.create).toHaveBeenCalled();
      expect(prismaService.slice.update).toHaveBeenCalled();
    });

    it('should update slice by negative steps', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({
        ...mockSlice,
        components: [],
        updates: [],
      });

      jest.spyOn(prismaService.sliceUpdate, 'create').mockResolvedValue({
        id: 'update-1',
        sliceId: '1',
        delta: -2,
        deltaType: 'steps',
        valueBefore: 2,
        valueAfter: 1,
        indexBefore: 5,
        indexAfter: 3,
        date: new Date(),
        notes: null,
        automatic: false,
        createdAt: new Date(),
      });

      jest.spyOn(prismaService.slice, 'update').mockResolvedValue({
        ...mockSlice,
        currentIndex: 3,
        currentValue: 1,
        components: [],
        updates: [],
      });

      const result = await service.updateBySteps('1', -2);

      expect(result).toBeDefined();
    });

    it('should throw error for composite slices', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({
        ...mockSlice,
        isComposite: true,
        components: [],
        updates: [],
      });

      await expect(service.updateBySteps('1', 2)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateByPercentage', () => {
    it('should update slice by percentage', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({
        ...mockSlice,
        currentValue: 100,
        components: [],
        updates: [],
      });

      jest.spyOn(formulaService, 'findClosestIndex').mockReturnValue(10);
      jest.spyOn(formulaService, 'calculateValue').mockReturnValue(50);

      jest.spyOn(prismaService.sliceUpdate, 'create').mockResolvedValue({
        id: 'update-1',
        sliceId: '1',
        delta: -50,
        deltaType: 'percentage',
        valueBefore: 100,
        valueAfter: 50,
        indexBefore: 5,
        indexAfter: 10,
        date: new Date(),
        notes: null,
        automatic: false,
        createdAt: new Date(),
      });

      jest.spyOn(prismaService.slice, 'update').mockResolvedValue({
        ...mockSlice,
        currentValue: 50,
        currentIndex: 10,
        components: [],
        updates: [],
      });

      const result = await service.updateByPercentage('1', -50);

      expect(result).toBeDefined();
      expect(formulaService.findClosestIndex).toHaveBeenCalled();
    });
  });

  describe('updateToValue', () => {
    it('should update slice to absolute value', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({
        ...mockSlice,
        components: [],
        updates: [],
      });

      jest.spyOn(formulaService, 'findClosestIndex').mockReturnValue(0);
      jest.spyOn(formulaService, 'calculateValue').mockReturnValue(0);

      jest.spyOn(prismaService.sliceUpdate, 'create').mockResolvedValue({
        id: 'update-1',
        sliceId: '1',
        delta: 0,
        deltaType: 'absolute',
        valueBefore: 2,
        valueAfter: 0,
        indexBefore: 5,
        indexAfter: 0,
        date: new Date(),
        notes: null,
        automatic: false,
        createdAt: new Date(),
      });

      jest.spyOn(prismaService.slice, 'update').mockResolvedValue({
        ...mockSlice,
        currentValue: 0,
        currentIndex: 0,
        components: [],
        updates: [],
      });

      const result = await service.updateToValue('1', 0);

      expect(result).toBeDefined();
    });

    it('should throw error for negative values', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({
        ...mockSlice,
        components: [],
        updates: [],
      });

      await expect(service.updateToValue('1', -10)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
