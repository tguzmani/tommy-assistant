import { seedSlices } from './seeds/slices.seed';

async function main() {
  console.log('🌱 Starting database seeding...');

  await seedSlices();

  console.log('🌱 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  });
