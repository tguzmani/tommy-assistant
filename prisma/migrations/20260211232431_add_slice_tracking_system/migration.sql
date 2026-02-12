-- CreateTable
CREATE TABLE "Slice" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "increaseType" TEXT NOT NULL,
    "increaseParams" JSONB,
    "decreaseType" TEXT NOT NULL,
    "decreaseParams" JSONB,
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "temporalType" TEXT,
    "expectedTime" TEXT,
    "gracePeriod" INTEGER,
    "penaltyInterval" INTEGER,
    "penaltyAmount" INTEGER,
    "maxInterval" INTEGER,
    "resetDaily" BOOLEAN DEFAULT false,
    "isComposite" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Slice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SliceComponent" (
    "id" TEXT NOT NULL,
    "sliceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "maxValue" INTEGER NOT NULL DEFAULT 100,
    "decayType" TEXT NOT NULL,
    "decayRate" DOUBLE PRECISION NOT NULL,
    "lastChecked" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SliceComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SliceUpdate" (
    "id" TEXT NOT NULL,
    "sliceId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "deltaType" TEXT NOT NULL DEFAULT 'steps',
    "valueBefore" INTEGER NOT NULL,
    "valueAfter" INTEGER NOT NULL,
    "indexBefore" INTEGER NOT NULL,
    "indexAfter" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SliceUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SliceComponentUpdate" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "valueBefore" INTEGER NOT NULL,
    "valueAfter" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SliceComponentUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Slice_slug_key" ON "Slice"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SliceComponent_sliceId_key_key" ON "SliceComponent"("sliceId", "key");

-- AddForeignKey
ALTER TABLE "Slice" ADD CONSTRAINT "Slice_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceComponent" ADD CONSTRAINT "SliceComponent_sliceId_fkey" FOREIGN KEY ("sliceId") REFERENCES "Slice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceUpdate" ADD CONSTRAINT "SliceUpdate_sliceId_fkey" FOREIGN KEY ("sliceId") REFERENCES "Slice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceComponentUpdate" ADD CONSTRAINT "SliceComponentUpdate_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SliceComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
