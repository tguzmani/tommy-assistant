import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { SliceService } from './slice.service';
import { CompositeSliceService } from './services/composite-slice.service';
import { SliceTemporalScheduler } from './services/schedulers/slice-temporal.scheduler';
import { CreateSliceDto } from './dto/create-slice.dto';
import { UpdateSliceDto } from './dto/update-slice.dto';
import { SliceUpdateInputDto, SliceUpdateType } from './dto/slice-update-input.dto';
import { ComponentUpdateInputDto } from './dto/component-update-input.dto';

/**
 * Controller for Slice REST API endpoints.
 * Provides endpoints for CRUD operations and updates.
 */
@Controller('slices')
export class SliceController {
  constructor(
    private readonly sliceService: SliceService,
    private readonly compositeService: CompositeSliceService,
    private readonly sliceTemporalScheduler: SliceTemporalScheduler,
  ) {}

  /**
   * Create a new slice.
   */
  @Post()
  create(@Body() createSliceDto: CreateSliceDto) {
    return this.sliceService.create(createSliceDto);
  }

  /**
   * Get all slices.
   */
  @Get()
  findAll() {
    return this.sliceService.findAll();
  }

  /**
   * Get a specific slice by ID.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sliceService.findOne(id);
  }

  /**
   * Get slice status by slug.
   */
  @Get('status/:slug')
  getStatus(@Param('slug') slug: string) {
    return this.sliceService.getSliceStatus(slug);
  }

  /**
   * Update a slice.
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSliceDto: UpdateSliceDto) {
    return this.sliceService.update(id, updateSliceDto);
  }

  /**
   * Delete a slice.
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sliceService.remove(id);
  }

  /**
   * Update a slice value.
   * Supports steps, percentage, and absolute value updates.
   */
  @Post(':id/update')
  async updateSlice(
    @Param('id') id: string,
    @Body() updateInput: SliceUpdateInputDto,
  ) {
    switch (updateInput.type) {
      case SliceUpdateType.STEPS:
        return this.sliceService.updateBySteps(
          id,
          updateInput.value,
          updateInput.notes,
        );

      case SliceUpdateType.PERCENTAGE:
        return this.sliceService.updateByPercentage(
          id,
          updateInput.value,
          updateInput.notes,
        );

      case SliceUpdateType.ABSOLUTE:
        return this.sliceService.updateToValue(
          id,
          updateInput.value,
          updateInput.notes,
        );

      default:
        throw new Error(`Unknown update type: ${updateInput.type}`);
    }
  }

  /**
   * Update a component of a composite slice.
   */
  @Post(':id/component')
  updateComponent(
    @Param('id') id: string,
    @Body() updateInput: ComponentUpdateInputDto,
  ) {
    return this.compositeService.updateComponent(
      id,
      updateInput.componentKey,
      updateInput.value,
      updateInput.notes,
    );
  }

  /**
   * Update multiple components at once.
   */
  @Post(':id/components')
  updateMultipleComponents(
    @Param('id') id: string,
    @Body() body: { componentKeys: string[]; notes?: string },
  ) {
    return this.compositeService.updateMultipleComponents(
      id,
      body.componentKeys,
      body.notes,
    );
  }

  /**
   * Get component status.
   */
  @Get(':id/component/:key')
  getComponentStatus(@Param('id') id: string, @Param('key') key: string) {
    return this.compositeService.getComponentStatus(id, key);
  }

  /**
   * Manually trigger all temporal checks.
   * Useful for testing without waiting for cron jobs.
   */
  @Post('temporal/run')
  async runTemporalChecks() {
    await this.sliceTemporalScheduler.runAllChecks();
    return { message: 'Temporal checks completed' };
  }

  /**
   * Get schedule summary for all temporal slices.
   * Shows next scheduled times and current status.
   */
  @Get('temporal/schedule')
  getSchedule() {
    return this.sliceTemporalScheduler.getScheduleSummary();
  }
}
