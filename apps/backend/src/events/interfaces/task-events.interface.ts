export interface TaskEvent {
  summary: string;
  start: string | null;
  end: string | null;
  duration_minutes: number;
  description: string;
}

export interface TaskEventsResult {
  task_id: string;
  task_name: string | null;
  total_hours: number;
  event_count: number;
  first_occurrence: string | null;
  last_occurrence: string | null;
  days_span: number;
  eligible_days_span: number;
  events: TaskEvent[];
}
