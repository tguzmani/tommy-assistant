/**
 * Time utility functions for slice temporal calculations
 */
export class TimeUtils {
  private static readonly DEFAULT_TIMEZONE = 'America/Caracas';

  /**
   * Calculate minutes elapsed between two dates
   */
  static minutesElapsed(from: Date, to: Date): number {
    return Math.floor((to.getTime() - from.getTime()) / (1000 * 60));
  }

  /**
   * Calculate hours elapsed between two dates
   */
  static hoursElapsed(from: Date, to: Date): number {
    return this.minutesElapsed(from, to) / 60;
  }

  /**
   * Calculate days elapsed between two dates
   */
  static daysElapsed(from: Date, to: Date): number {
    return this.hoursElapsed(from, to) / 24;
  }

  /**
   * Calculate weeks elapsed between two dates
   */
  static weeksElapsed(from: Date, to: Date): number {
    return this.daysElapsed(from, to) / 7;
  }

  /**
   * Check if we're past a specific time today
   * @param timeString - Format: "HH:MM" (e.g., "09:00", "23:30")
   * @param gracePeriodMinutes - Additional minutes before penalty
   * @param timezone - Timezone (default: America/Caracas)
   * @returns { isPast: boolean, minutesLate: number }
   */
  static isPastScheduledTime(
    timeString: string,
    gracePeriodMinutes: number = 0,
    timezone: string = this.DEFAULT_TIMEZONE,
  ): { isPast: boolean; minutesLate: number } {
    const now = new Date();

    // Parse timeString to get hours and minutes
    const [hours, minutes] = timeString.split(':').map(Number);

    // Create expected time for today
    const expectedTime = new Date(now);
    expectedTime.setHours(hours, minutes, 0, 0);

    // Add grace period
    const deadlineTime = new Date(
      expectedTime.getTime() + gracePeriodMinutes * 60 * 1000,
    );

    // Calculate minutes late
    const minutesLate = this.minutesElapsed(deadlineTime, now);

    return {
      isPast: now > deadlineTime,
      minutesLate: Math.max(0, minutesLate),
    };
  }

  /**
   * Get start of day (midnight)
   */
  static getStartOfDay(
    date: Date = new Date(),
    timezone: string = this.DEFAULT_TIMEZONE,
  ): Date {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    return startOfDay;
  }

  /**
   * Get end of day (23:59:59.999)
   */
  static getEndOfDay(
    date: Date = new Date(),
    timezone: string = this.DEFAULT_TIMEZONE,
  ): Date {
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay;
  }

  /**
   * Check if two dates are on the same day
   */
  static isSameDay(
    date1: Date,
    date2: Date,
    timezone: string = this.DEFAULT_TIMEZONE,
  ): boolean {
    const d1 = new Date(date1);
    const d2 = new Date(date2);

    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  /**
   * Format duration in human-readable format
   */
  static formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m`;
    }
  }
}
