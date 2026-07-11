import { Task, ScheduleItem, OptimizationSuggestion, UserPreferences } from '../types';

// Convert "HH:MM" string to minutes from midnight
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

// Convert minutes from midnight to "HH:MM" string
export function minutesToTime(totalMinutes: number): string {
  const normalized = (totalMinutes + 1440) % 1440; // Handle wrapping
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Calculate duration in minutes for a task dynamically
export function getTaskDuration(task: Task): number {
  if (task.startTime && task.endTime) {
    const startMins = timeToMinutes(task.startTime);
    const endMins = timeToMinutes(task.endTime);
    if (endMins > startMins) {
      return endMins - startMins;
    }
  }
  return 60; // Default to 60 minutes if end time is not specified
}

export function localScheduler(tasks: Task[], preferences: UserPreferences): {
  schedule: ScheduleItem[];
  suggestions: OptimizationSuggestion[];
  dailyQuote: string;
} {
  const schedule: ScheduleItem[] = [];
  const suggestions: OptimizationSuggestion[] = [];

  // Standard fixed circadian blocks
  const fixedBlocks: { activity: string; startTime: string; endTime: string; type: ScheduleItem['type']; description: string }[] = [];

  // A. Morning routine
  fixedBlocks.push({
    activity: 'Chuẩn bị & Ăn sáng lành mạnh',
    startTime: preferences.wakeUpTime,
    endTime: minutesToTime(timeToMinutes(preferences.wakeUpTime) + 45),
    type: 'routine',
    description: 'Y học lối sống khuyên dùng bữa sáng giàu protein & chất xơ, tiếp xúc ánh sáng mặt trời 15 phút để điều hòa nhịp sinh học Cortisol.'
  });

  // B. Lunch
  fixedBlocks.push({
    activity: 'Nghỉ trưa & Ăn trưa điều độ',
    startTime: '12:00',
    endTime: '13:00',
    type: 'meal',
    description: 'Tránh xa màn hình máy tính. Thưởng thức bữa trưa chậm rãi và chợp mắt 15-20 phút giúp tái tạo tế bào não.'
  });

  // C. Dinner
  fixedBlocks.push({
    activity: 'Bữa tối & Thời gian gia đình',
    startTime: '18:30',
    endTime: '19:30',
    type: 'meal',
    description: 'Dùng bữa tối nhẹ nhàng, tốt cho hệ vi sinh đường ruột và hệ tiêu hóa.'
  });

  // D. Sleep Hygiene
  const sleepStartMins = timeToMinutes(preferences.sleepTime) - 30;
  fixedBlocks.push({
    activity: 'Vệ sinh giấc ngủ (Sleep Hygiene)',
    startTime: minutesToTime(sleepStartMins),
    endTime: preferences.sleepTime,
    type: 'routine',
    description: 'Ngắt hoàn toàn ánh sáng xanh từ điện thoại/máy tính để kích thích Melatonin tự nhiên, chuẩn bị cho giấc ngủ sâu phục hồi.'
  });

  // Now compile all active tasks (not completed, or completed based on preference)
  const activeTasks = preferences.showCompletedInSchedule !== false
    ? [...tasks]
    : [...tasks].filter(t => !t.completed);

  // Sort tasks by startTime
  activeTasks.sort((a, b) => (a.startTime || '08:00').localeCompare(b.startTime || '08:00'));

  // Convert tasks to events
  const events: { id: string | null; activity: string; startTime: string; endTime: string; type: ScheduleItem['type']; taskId: string | null; description: string }[] = [];

  // 1. Add all tasks
  activeTasks.forEach((task) => {
    const tStart = task.startTime || '08:00';
    const taskDuration = getTaskDuration(task);
    const endT = task.endTime || minutesToTime(timeToMinutes(tStart) + taskDuration);
    
    let desc = task.notes || `Thực hiện công việc có mức độ ưu tiên: ${task.priority === 'high' ? 'Cao (Cần tập trung tối đa)' : task.priority === 'medium' ? 'Trung bình' : 'Thấp'}.`;
    if (task.date) {
      desc += ` Ngày thực hiện: ${task.date}.`;
    }

    events.push({
      id: task.id,
      activity: task.title,
      startTime: tStart,
      endTime: endT,
      type: 'task',
      taskId: task.id,
      description: desc
    });
  });

  // 2. Overlay fixed blocks if they don't severely overlap with task events
  fixedBlocks.forEach((block, idx) => {
    const blockStart = timeToMinutes(block.startTime);
    const blockEnd = timeToMinutes(block.endTime);
    
    // Check if there is a task that fully covers this block or overlaps significantly
    const hasSevereOverlap = events.some(evt => {
      const evtStart = timeToMinutes(evt.startTime);
      const evtEnd = timeToMinutes(evt.endTime);
      return (evtStart < blockEnd && evtEnd > blockStart);
    });

    if (!hasSevereOverlap) {
      events.push({
        id: `fixed_${idx}`,
        activity: block.activity,
        startTime: block.startTime,
        endTime: block.endTime,
        type: block.type,
        taskId: null,
        description: block.description
      });
    }
  });

  // Sort all events by startTime
  events.sort((a, b) => {
    const cmp = a.startTime.localeCompare(b.startTime);
    if (cmp !== 0) return cmp;
    if (a.type === 'task' && b.type !== 'task') return -1;
    if (a.type !== 'task' && b.type === 'task') return 1;
    return 0;
  });

  // 3. Now build the timeline and insert breaks / buffers in gaps
  let currentMins = timeToMinutes(preferences.wakeUpTime);
  const sleepMins = timeToMinutes(preferences.sleepTime);
  let itemIdCounter = 1;

  events.forEach(evt => {
    const evtStart = timeToMinutes(evt.startTime);
    const evtEnd = timeToMinutes(evt.endTime);

    // If the event starts after our current time, insert a break or buffer in the gap
    if (evtStart > currentMins && evtStart < sleepMins) {
      const gapDuration = evtStart - currentMins;
      if (gapDuration >= preferences.breakInterval) {
        // Insert a break
        const breakEnd = Math.min(currentMins + preferences.breakDuration, evtStart);
        schedule.push({
          id: `item_break_${itemIdCounter++}`,
          timeSlot: `${minutesToTime(currentMins)} - ${minutesToTime(breakEnd)}`,
          startTime: minutesToTime(currentMins),
          endTime: minutesToTime(breakEnd),
          activity: 'Nghỉ giải lao y khoa',
          type: 'break',
          taskId: null,
          duration: breakEnd - currentMins,
          description: 'Thực hiện quy tắc 20-20-20 bảo vệ mắt, uống 1 cốc nước ấm, đứng dậy giãn cơ vai gáy để lưu thông máu.'
        });
        currentMins = breakEnd;
      }
      
      // If there is still a gap left, add it as buffer/rest
      if (evtStart > currentMins) {
        const remainingGap = evtStart - currentMins;
        schedule.push({
          id: `item_buf_${itemIdCounter++}`,
          timeSlot: `${minutesToTime(currentMins)} - ${evt.startTime}`,
          startTime: minutesToTime(currentMins),
          endTime: evt.startTime,
          activity: 'Nghỉ ngơi tĩnh tâm / Thời gian dự phòng',
          type: 'buffer',
          taskId: null,
          duration: remainingGap,
          description: 'Thư giãn cơ bắp, bổ sung nước và chuẩn bị tinh thần cho hoạt động tiếp theo.'
        });
      }
    }

    // Only schedule if it fits or starts before sleepTime
    if (evtStart < sleepMins) {
      const actualEnd = Math.min(evtEnd, sleepMins);
      const actualDuration = actualEnd - evtStart;
      if (actualDuration > 0) {
        schedule.push({
          id: evt.taskId || `item_task_${itemIdCounter++}`,
          timeSlot: `${evt.startTime} - ${minutesToTime(actualEnd)}`,
          startTime: evt.startTime,
          endTime: minutesToTime(actualEnd),
          activity: evt.activity,
          type: evt.type,
          taskId: evt.taskId,
          duration: actualDuration,
          description: evt.description
        });
      }
      currentMins = actualEnd;
    }
  });

  // If we haven't reached sleepTime yet, fill the rest with Sleep Hygiene if we haven't added it
  if (currentMins < sleepMins) {
    const remaining = sleepMins - currentMins;
    const alreadyHasSleepPrep = schedule.some(s => s.activity.includes('Sleep Hygiene') || s.activity.includes('Vệ sinh giấc ngủ'));
    if (!alreadyHasSleepPrep && remaining >= 15) {
      schedule.push({
        id: `item_sleep_${itemIdCounter++}`,
        timeSlot: `${minutesToTime(currentMins)} - ${preferences.sleepTime}`,
        startTime: minutesToTime(currentMins),
        endTime: preferences.sleepTime,
        activity: 'Vệ sinh giấc ngủ (Sleep Hygiene)',
        type: 'routine',
        taskId: null,
        duration: remaining,
        description: 'Ngắt hoàn toàn ánh sáng xanh từ điện thoại/máy tính để kích thích Melatonin tự nhiên, chuẩn bị cho giấc ngủ sâu phục hồi.'
      });
    } else {
      schedule.push({
        id: `item_end_${itemIdCounter++}`,
        timeSlot: `${minutesToTime(currentMins)} - ${preferences.sleepTime}`,
        startTime: minutesToTime(currentMins),
        endTime: preferences.sleepTime,
        activity: 'Nghỉ ngơi tự do cuối ngày',
        type: 'buffer',
        taskId: null,
        duration: remaining,
        description: 'Thư giãn hoàn toàn cơ thể, hít thở sâu chuẩn bị đi ngủ.'
      });
    }
  }

  // 3. Generate suggestions
  // Suggestion A: Task grouping
  const categories = tasks.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const multiTaskCategories = Object.entries(categories).filter(([_, count]) => count > 1);
  if (multiTaskCategories.length > 0) {
    suggestions.push({
      id: 'sug_grouping',
      title: 'Tối ưu nhận thức: Gộp nhóm công việc',
      content: `Y học nhận thức khuyên bạn gộp các việc nhóm "${multiTaskCategories.map(([cat]) => cat).join(', ')}" để làm liên tục. Điều này ngăn hiện tượng "rò rỉ sự chú ý" và giảm căng thẳng cho vỏ não trước trán.`,
      type: 'grouping'
    });
  }

  // Suggestion B: Priority Check
  const highPriorityTasksCount = tasks.filter(t => t.priority === 'high' && !t.completed).length;
  if (highPriorityTasksCount > 2) {
    suggestions.push({
      id: 'sug_priority',
      title: 'Cảnh báo quá tải Adrenaline',
      content: `Có ${highPriorityTasksCount} việc ưu tiên Cao. Não bộ không thể duy trì trạng thái khẩn cấp quá lâu mà không tăng tiết hormone stress. Hãy chọn duy nhất 1 mục tiêu sống còn để giải quyết triệt để trước.`,
      type: 'priority'
    });
  } else {
    suggestions.push({
      id: 'sug_priority_ok',
      title: 'Phân bổ năng lượng thần kinh lý tưởng',
      content: 'Mức độ ưu tiên của bạn rất khoa học. Sắp xếp việc quan trọng nhất vào khung giờ vàng giúp bạn tận dụng tối đa nhịp sóng não Beta lúc minh mẫn nhất.',
      type: 'priority'
    });
  }

  // Suggestion C: Health & Break Check
  const totalWorkDuration = tasks.filter(t => !t.completed).reduce((sum, t) => sum + getTaskDuration(t), 0);
  if (totalWorkDuration > 300) {
    suggestions.push({
      id: 'sug_health_rest',
      title: 'Nguy cơ suy nhược & Kiệt sức (Burnout)',
      content: `Tổng thời gian làm việc ${Math.round(totalWorkDuration / 60 * 10) / 10} giờ là quá cao đối với sự tập trung liên tục. Hãy bắt buộc nghỉ giải lao mỗi ${preferences.breakInterval} phút để bảo vệ mắt và hệ cơ xương khớp khỏi tổn thương lâu dài.`,
      type: 'health'
    });
  } else {
    suggestions.push({
      id: 'sug_health_ok',
      title: 'Cân bằng sinh học tuyệt vời',
      content: 'Lịch trình làm việc dưới 5 tiếng giúp bảo vệ sức khỏe tim mạch và duy trì khả năng tái nạp Dopamine tự nhiên cho ngày làm việc kế tiếp.',
      type: 'health'
    });
  }

  // Suggestion D: Efficiency
  suggestions.push({
    id: 'sug_efficiency',
    title: 'Kỹ thuật giãn cách và bù nước',
    content: `Hãy chuẩn bị sẵn một bình nước ấm 500ml trên bàn làm việc. Cứ sau mỗi chu kỳ làm việc, hãy bổ sung nước. Não bộ chứa 80% là nước, mất đi 2% lượng nước có thể làm giảm 20% khả năng tập trung của bạn.`,
    type: 'efficiency'
  });

  // Quotes list
  const quotes = [
    "Sức khỏe là trạng thái hài hòa hoàn toàn của cơ thể, tâm trí và tinh thần.",
    "Bảo vệ nhịp sinh học của bạn chính là bảo vệ nguồn sống quý giá nhất.",
    "Giấc ngủ là liều thuốc giải độc tốt nhất cho những lo âu ban ngày.",
    "Hãy lắng nghe cơ thể mình trước khi nó buộc bạn phải dừng lại.",
    "Sự tập trung chất lượng cao trong thời gian ngắn tốt hơn làm việc uể oải cả ngày dài."
  ];
  const dailyQuote = quotes[Math.floor(Math.random() * quotes.length)];

  return {
    schedule,
    suggestions,
    dailyQuote
  };
}
