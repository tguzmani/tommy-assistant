import { Injectable, Logger } from '@nestjs/common';
import { GoogleCalendarApiClient, CalendarEvent } from '../common/google-calendar-api.client';
import { ClientHours, TaskSummary } from './interfaces/client-hours.interface';
import { TaskEventsResult, TaskEvent } from './interfaces/task-events.interface';
import { GetClientHoursDto } from './dto/get-client-hours.dto';
import { CLIENT_PATTERNS, TASK_PATTERN, CARACAS_TZ } from './events.constants';

interface TaskAccumulator {
  task_id: string;
  task_name: string;
  total_minutes: number;
  event_count: number;
  first_occurrence: Date | null;
  last_occurrence: Date | null;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly calendarApi: GoogleCalendarApiClient) {}

  async getRecentEvents(daysBack = 7): Promise<CalendarEvent[]> {
    return this.calendarApi.getEvents({ daysBack });
  }

  async getClientHours(dto: GetClientHoursDto): Promise<ClientHours> {
    const { client, daysBack, startDate, endDate } = dto;
    const clientLower = client.toLowerCase();

    if (!CLIENT_PATTERNS[clientLower]) {
      throw new Error(`Unknown client: ${client}`);
    }

    const patterns = CLIENT_PATTERNS[clientLower];
    const events = await this.calendarApi.getEvents({
      daysBack,
      startDate,
      endDate,
    });

    const matchingEvents: CalendarEvent[] = [];
    let totalMinutes = 0;
    const tasks: Map<string, TaskAccumulator> = new Map();

    for (const event of events) {
      const summary = event.summary || '';

      if (patterns.some((pattern) => summary.includes(pattern))) {
        matchingEvents.push(event);
        const duration = this.calculateEventDuration(event);
        totalMinutes += duration;

        const taskId = this.extractTaskId(summary);
        if (taskId) {
          const eventStart = this.getEventDateTime(event, true);
          const eventEnd = this.getEventDateTime(event, false);

          if (!tasks.has(taskId)) {
            tasks.set(taskId, {
              task_id: taskId,
              task_name: this.cleanTaskName(summary),
              total_minutes: 0,
              event_count: 0,
              first_occurrence: eventStart,
              last_occurrence: eventEnd,
            });
          }

          const task = tasks.get(taskId)!;
          task.total_minutes += duration;
          task.event_count += 1;

          if (eventStart && task.first_occurrence) {
            if (eventStart < task.first_occurrence) {
              task.first_occurrence = eventStart;
            }
          }

          if (eventEnd && task.last_occurrence) {
            if (eventEnd > task.last_occurrence) {
              task.last_occurrence = eventEnd;
            }
          }
        }
      }
    }

    const tasksList: TaskSummary[] = Array.from(tasks.values()).map((task) => {
      const first = task.first_occurrence;
      const last = task.last_occurrence;
      let daysSpan = 0;
      let eligibleDaysSpan = 0;

      if (first && last) {
        const firstDate = new Date(first.toDateString());
        const lastDate = new Date(last.toDateString());
        daysSpan = Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        eligibleDaysSpan = this.countWeekdays(firstDate, lastDate);
      }

      return {
        task_id: task.task_id,
        task_name: task.task_name,
        total_hours: Math.round((task.total_minutes / 60) * 100) / 100,
        event_count: task.event_count,
        first_occurrence: first ? first.toISOString() : null,
        last_occurrence: last ? last.toISOString() : null,
        days_span: daysSpan,
        eligible_days_span: eligibleDaysSpan,
      };
    });

    return {
      client,
      event_count: matchingEvents.length,
      total_hours: Math.round((totalMinutes / 60) * 100) / 100,
      total_tasks: tasksList.length,
      tasks: tasksList.sort((a, b) => b.total_hours - a.total_hours),
    };
  }

  async getTaskEvents(taskId: string, daysBack = 365): Promise<TaskEventsResult | null> {
    const events = await this.calendarApi.getEvents({ daysBack });

    const matchingEvents: TaskEvent[] = [];
    let totalMinutes = 0;
    let taskName: string | null = null;
    let firstOccurrence: Date | null = null;
    let lastOccurrence: Date | null = null;

    for (const event of events) {
      const summary = event.summary || '';

      if (summary.includes(taskId)) {
        const eventStart = this.getEventDateTime(event, true);
        const eventEnd = this.getEventDateTime(event, false);
        const duration = this.calculateEventDuration(event);

        if (taskName === null) {
          taskName = this.cleanTaskName(summary);
        }

        totalMinutes += duration;

        matchingEvents.push({
          summary,
          start: eventStart ? eventStart.toISOString() : null,
          end: eventEnd ? eventEnd.toISOString() : null,
          duration_minutes: duration,
          description: event.description || '',
        });

        if (eventStart) {
          if (firstOccurrence === null || eventStart < firstOccurrence) {
            firstOccurrence = eventStart;
          }
        }

        if (eventEnd) {
          if (lastOccurrence === null || eventEnd > lastOccurrence) {
            lastOccurrence = eventEnd;
          }
        }
      }
    }

    if (matchingEvents.length === 0) {
      return null;
    }

    let daysSpan = 0;
    let eligibleDaysSpan = 0;

    if (firstOccurrence && lastOccurrence) {
      const firstDate = new Date(firstOccurrence.toDateString());
      const lastDate = new Date(lastOccurrence.toDateString());
      daysSpan = Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      eligibleDaysSpan = this.countWeekdays(firstDate, lastDate);
    }

    return {
      task_id: taskId,
      task_name: taskName,
      total_hours: Math.round((totalMinutes / 60) * 100) / 100,
      event_count: matchingEvents.length,
      first_occurrence: firstOccurrence ? firstOccurrence.toISOString() : null,
      last_occurrence: lastOccurrence ? lastOccurrence.toISOString() : null,
      days_span: daysSpan,
      eligible_days_span: eligibleDaysSpan,
      events: matchingEvents.sort((a, b) => (a.start || '').localeCompare(b.start || '')),
    };
  }

  private extractTaskId(summary: string): string | null {
    const match = summary.match(TASK_PATTERN);
    return match ? match[0] : null;
  }

  private cleanTaskName(summary: string): string {
    // Remove content in parentheses
    let cleaned = summary.replace(/\s*\([^)]*\)\s*/g, ' ');
    // Remove task ID pattern
    cleaned = cleaned.replace(/(OMV|VCALL|OM|AKI)-\d+\s*[-:]?\s*/g, '');
    // Normalize multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ');
    return cleaned.trim();
  }

  private getEventDateTime(event: CalendarEvent, isStart: boolean): Date | null {
    const key = isStart ? 'start' : 'end';
    const timeObj = event[key];
    const timeStr = timeObj?.dateTime || timeObj?.date;

    if (!timeStr) {
      return null;
    }

    if (timeStr.includes('T')) {
      const dt = new Date(timeStr.replace('Z', '+00:00'));
      // Convert to Caracas timezone
      return new Date(dt.toLocaleString('en-US', { timeZone: CARACAS_TZ }));
    }

    return new Date(timeStr);
  }

  private calculateEventDuration(event: CalendarEvent): number {
    const start = event.start;
    const end = event.end;

    const startStr = start?.dateTime || start?.date;
    const endStr = end?.dateTime || end?.date;

    if (!startStr || !endStr) {
      return 0;
    }

    if (!startStr.includes('T')) {
      return 0; // All-day events have no duration
    }

    const startDt = new Date(startStr.replace('Z', '+00:00'));
    const endDt = new Date(endStr.replace('Z', '+00:00'));

    return Math.floor((endDt.getTime() - startDt.getTime()) / (1000 * 60));
  }

  private countWeekdays(startDate: Date, endDate: Date): number {
    let weekdays = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Monday=1, Friday=5
        weekdays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return weekdays;
  }
}
