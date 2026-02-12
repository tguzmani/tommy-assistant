import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export const slicesData = [
  {
    slug: 'gym',
    name: 'Gym',
    description: 'Gym attendance tracking',
    increaseType: 'exponential',
    increaseParams: { base: 1.15 }, // 15% more each time
    decreaseType: 'exponential',
    decreaseParams: { base: 1.3 }, // 30% drop each miss
    currentIndex: 0,
    currentValue: 0,
    temporalType: 'manual',
  },

  {
    slug: 'ord',
    name: 'Order',
    description: 'Organization and orderliness tracking',
    increaseType: 'sqrt',
    increaseParams: null,
    decreaseType: 'linear',
    decreaseParams: { multiplier: 2 },
    currentIndex: 0,
    currentValue: 0,
    temporalType: 'manual',
  },

  {
    slug: 'org',
    name: 'Organization',
    description: 'General organization tracking',
    increaseType: 'sqrt',
    increaseParams: null,
    decreaseType: 'linear',
    decreaseParams: { multiplier: 2 },
    currentIndex: 0,
    currentValue: 0,
    temporalType: 'manual',
  },

  {
    slug: 'hea',
    name: 'Health',
    description: 'General health tracking',
    increaseType: 'logarithmic',
    increaseParams: { multiplier: 10 },
    decreaseType: 'exponential',
    decreaseParams: { base: 1.5 },
    currentIndex: 0,
    currentValue: 0,
    temporalType: 'manual',
  },

  {
    slug: 'hyd',
    name: 'Hydration',
    description: 'Hydration tracking',
    increaseType: 'linear',
    increaseParams: { multiplier: 5 },
    decreaseType: 'linear',
    decreaseParams: { multiplier: 3 },
    currentIndex: 0,
    currentValue: 0,
    temporalType: 'continuous',
    maxInterval: 120, // 2 hours
    penaltyInterval: 30,
    penaltyAmount: -1,
  },

  {
    slug: 'om',
    name: 'OneMeta',
    description: 'OneMeta work tracking',
    increaseType: 'exponential',
    increaseParams: { base: 1.2 },
    decreaseType: 'exponential',
    decreaseParams: { base: 1.3 },
    currentIndex: 0,
    currentValue: 0,
    temporalType: 'manual',
  },

  {
    slug: 'gar',
    name: 'Garibay',
    description: 'Garibay work tracking',
    increaseType: 'exponential',
    increaseParams: { base: 1.2 },
    decreaseType: 'exponential',
    decreaseParams: { base: 1.3 },
    currentIndex: 0,
    currentValue: 0,
    temporalType: 'manual',
  },

  {
    slug: 'nut',
    name: 'Nutrition',
    description: 'Nutrition tracking',
    increaseType: 'linear',
    increaseParams: { multiplier: 3 },
    decreaseType: 'exponential',
    decreaseParams: { base: 1.4 },
    currentIndex: 0,
    currentValue: 0,
    temporalType: 'scheduled',
    expectedTime: '09:00',
    gracePeriod: 30,
    penaltyInterval: 15,
    penaltyAmount: -1,
    resetDaily: true,
  },

  {
    slug: 'zzz',
    name: 'Sleep',
    description: 'Sleep tracking',
    increaseType: 'logarithmic',
    increaseParams: { multiplier: 15 },
    decreaseType: 'linear',
    decreaseParams: { multiplier: 5 },
    currentIndex: 0,
    currentValue: 0,
    temporalType: 'scheduled',
    expectedTime: '23:00',
    gracePeriod: 0,
    penaltyInterval: 30,
    penaltyAmount: -1,
    resetDaily: true,
  },

  {
    slug: 'rel',
    name: 'Relationship',
    description: 'Relationship quality tracking',
    increaseType: 'logarithmic',
    increaseParams: { multiplier: 20 },
    decreaseType: 'exponential',
    decreaseParams: { base: 1.4 },
    currentIndex: 0,
    currentValue: 0,
    temporalType: 'manual',
  },
];

export const hygieneSliceData = {
  slug: 'hyg',
  name: 'Hygiene',
  description: 'Composite hygiene tracking',
  increaseType: 'linear',
  decreaseType: 'linear',
  isComposite: true,
  currentIndex: 0,
  currentValue: 0,
  temporalType: 'manual',
  components: [
    {
      key: 'teeth',
      name: 'Teeth',
      weight: 30,
      maxValue: 100,
      currentValue: 0,
      decayType: 'daily',
      decayRate: 20,
    },
    {
      key: 'shower',
      name: 'Shower',
      weight: 25,
      maxValue: 100,
      currentValue: 0,
      decayType: 'daily',
      decayRate: 30,
    },
    {
      key: 'nails',
      name: 'Nails',
      weight: 20,
      maxValue: 100,
      currentValue: 0,
      decayType: 'weekly',
      decayRate: 10,
    },
    {
      key: 'haircut',
      name: 'Haircut',
      weight: 15,
      maxValue: 100,
      currentValue: 0,
      decayType: 'weekly',
      decayRate: 5,
    },
    {
      key: 'shave',
      name: 'Shave',
      weight: 10,
      maxValue: 100,
      currentValue: 0,
      decayType: 'daily',
      decayRate: 15,
    },
  ],
};

/**
 * Seed the database with initial slices.
 */
export async function seedSlices() {
  console.log('Seeding slices...');

  // Seed regular slices
  for (const sliceData of slicesData) {
    await prisma.slice.upsert({
      where: { slug: sliceData.slug },
      update: {},
      create: sliceData,
    });
    console.log(`✓ Seeded slice: ${sliceData.slug}`);
  }

  // Seed hygiene composite slice
  const { components, ...hygieneSlice } = hygieneSliceData;

  const hygieneSliceRecord = await prisma.slice.upsert({
    where: { slug: hygieneSlice.slug },
    update: {},
    create: hygieneSlice,
  });

  console.log(`✓ Seeded composite slice: ${hygieneSlice.slug}`);

  // Seed hygiene components
  for (const componentData of components) {
    await prisma.sliceComponent.upsert({
      where: {
        sliceId_key: {
          sliceId: hygieneSliceRecord.id,
          key: componentData.key,
        },
      },
      update: {},
      create: {
        ...componentData,
        sliceId: hygieneSliceRecord.id,
      },
    });
    console.log(`  ✓ Seeded component: ${componentData.key}`);
  }

  console.log('✅ Slices seeding completed!');
}

// Run if called directly
if (require.main === module) {
  seedSlices()
    .catch((e) => {
      console.error('Error seeding slices:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
