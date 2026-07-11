export type Priority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  startTime: string; // "HH:MM" - Bắt buộc
  endTime?: string;  // "HH:MM" - Không bắt buộc
  date: string;      // "YYYY-MM-DD" - Ngày/Tháng/Năm công việc thay thế hạn chót
  priority: Priority;
  category: string; // e.g., "Học tập", "Công việc", "Sức khỏe", "Cá nhân"
  notes?: string;
  completed: boolean;
}

export type ActivityType = 'task' | 'break' | 'meal' | 'buffer' | 'routine';

export interface ScheduleItem {
  id: string;
  timeSlot: string; // e.g., "08:00 - 09:30"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  activity: string;
  type: ActivityType;
  taskId: string | null;
  duration: number; // in minutes
  description: string;
}

export interface OptimizationSuggestion {
  id: string;
  title: string;
  content: string;
  type: 'grouping' | 'priority' | 'health' | 'efficiency';
}

export interface ScheduleResponse {
  schedule: ScheduleItem[];
  suggestions: OptimizationSuggestion[];
  dailyQuote: string;
  isAiGenerated: boolean;
  error?: string;
}

export interface UserPreferences {
  wakeUpTime: string; // "07:00"
  sleepTime: string; // "23:00"
  breakInterval: number; // in minutes, work duration before a break
  breakDuration: number; // in minutes
  focusStyle: 'priority' | 'deadline' | 'energy'; // priority first, closest deadline, or hard tasks in morning
  showCompletedInSchedule?: boolean; // Keep completed tasks in daily schedule
}
