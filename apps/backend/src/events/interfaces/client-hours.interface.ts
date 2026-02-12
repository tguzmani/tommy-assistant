export interface TaskSummary {
  task_id: string;
  task_name: string;
  total_hours: number;
  event_count: number;
  first_occurrence: string | null;
  last_occurrence: string | null;
  days_span: number;
  eligible_days_span: number;
}

export interface ClientHours {
  client: string;
  event_count: number;
  total_hours: number;
  total_tasks: number;
  tasks: TaskSummary[];
}
