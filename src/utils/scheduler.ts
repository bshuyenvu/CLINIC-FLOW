import { Task, ScheduleItem, OptimizationSuggestion, UserPreferences, Priority } from '../types';

// Convert "HH:MM" string to minutes from midnight
export function timeToMinutes(timeStr: string): number {
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

export function localScheduler(tasks: Task[], preferences: UserPreferences): {
  schedule: ScheduleItem[];
  suggestions: OptimizationSuggestion[];
  dailyQuote: string;
} {
  const schedule: ScheduleItem[] = [];
  const suggestions: OptimizationSuggestion[] = [];

  // 1. Sort the tasks based on preference focusStyle
  const sortedTasks = preferences.showCompletedInSchedule !== false
    ? [...tasks]
    : [...tasks].filter(t => !t.completed);
  
  if (preferences.focusStyle === 'priority') {
    // Sort High -> Medium -> Low
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    sortedTasks.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);
  } else if (preferences.focusStyle === 'deadline') {
    // Sort by deadline (closest first)
    sortedTasks.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });
  } else if (preferences.focusStyle === 'energy') {
    // High duration / high priority first for morning, shorter / low priority for later
    const getEnergyScore = (t: Task) => {
      let score = t.duration;
      if (t.priority === 'high') score += 120;
      if (t.priority === 'medium') score += 60;
      return score;
    };
    sortedTasks.sort((a, b) => getEnergyScore(b) - getEnergyScore(a));
  }

  // 2. Schedule settings
  let currentTime = timeToMinutes(preferences.wakeUpTime);
  const sleepTime = timeToMinutes(preferences.sleepTime);
  
  const lunchStart = timeToMinutes('12:00');
  const lunchDuration = 60; // 1 hour lunch
  const dinnerStart = timeToMinutes('18:30');
  const dinnerDuration = 60; // 1 hour dinner

  let consecutiveWorkMinutes = 0;
  let itemIdCounter = 1;
  const nextId = () => `item_${itemIdCounter++}`;

  // Helper to add schedule item
  const addItem = (activity: string, duration: number, type: ScheduleItem['type'], taskId: string | null = null, description = '') => {
    const startStr = minutesToTime(currentTime);
    const endStr = minutesToTime(currentTime + duration);
    schedule.push({
      id: nextId(),
      timeSlot: `${startStr} - ${endStr}`,
      startTime: startStr,
      endTime: endStr,
      activity,
      type,
      taskId,
      duration,
      description
    });
    currentTime += duration;
  };

  // A. Morning routine
  if (currentTime < lunchStart) {
    const routineDuration = 45; // 45 mins morning prep
    addItem('Chuẩn bị & Ăn sáng lành mạnh', routineDuration, 'routine', null, 'Y học lối sống khuyên dùng bữa sáng giàu protein & chất xơ, tiếp xúc ánh sáng mặt trời 15 phút để điều hòa nhịp sinh học Cortisol.');
  }

  // B. Loop over tasks and schedule them
  for (const task of sortedTasks) {
    // Check if we need to insert Lunch
    if (currentTime < lunchStart && (currentTime + task.duration) > lunchStart) {
      // Add lunch first
      const gap = lunchStart - currentTime;
      if (gap > 10) {
        addItem('Hoàn tất việc dở dang / Chuẩn bị nghỉ trưa', gap, 'buffer', null, 'Giảm dần nhịp độ tư duy, thư giãn cơ bắp để hệ tiêu hóa hoạt động tốt nhất.');
      }
      addItem('Nghỉ trưa & Ăn trưa điều độ', lunchDuration, 'meal', null, 'Tránh xa màn hình máy tính. Thưởng thức bữa trưa chậm rãi và chợp mắt 15-20 phút giúp tái tạo tế bào não.');
      consecutiveWorkMinutes = 0;
    }

    // Check if we need to insert Dinner
    if (currentTime < dinnerStart && (currentTime + task.duration) > dinnerStart) {
      const gap = dinnerStart - currentTime;
      if (gap > 10) {
        addItem('Thư giãn cuối ngày / Chuẩn bị ăn tối', gap, 'buffer', null, 'Hạ nhiệt cơ thể, kết thúc các cuộc họp căng thẳng.');
      }
      addItem('Bữa tối & Thời gian gia đình', dinnerDuration, 'meal', null, 'Dùng bữa tối thanh đạm trước giờ ngủ ít nhất 3 tiếng để tránh trào ngược dạ dày thực quản (GERD).');
      consecutiveWorkMinutes = 0;
    }

    // Check if current time is past sleep time
    if (currentTime >= sleepTime) {
      break;
    }

    // Check if we need a periodic break before this task
    if (consecutiveWorkMinutes >= preferences.breakInterval) {
      addItem('Nghỉ giải lao y khoa', preferences.breakDuration, 'break', null, 'Thực hiện quy tắc 20-20-20 bảo vệ mắt, uống 1 cốc nước ấm, đứng dậy giãn cơ vai gáy để lưu thông máu.');
      consecutiveWorkMinutes = 0;
    }

    // Double check lunch/dinner if we just skipped past their start hours
    if (currentTime >= lunchStart && currentTime < (lunchStart + lunchDuration) && !schedule.some(s => s.activity.includes('Ăn trưa'))) {
      addItem('Nghỉ trưa & Ăn trưa điều độ', lunchDuration, 'meal', null, 'Nạp năng lượng và nghỉ ngơi tĩnh tâm để giảm hormone stress Adrenaline.');
      consecutiveWorkMinutes = 0;
    }
    if (currentTime >= dinnerStart && currentTime < (dinnerStart + dinnerDuration) && !schedule.some(s => s.activity.includes('Ăn tối'))) {
      addItem('Bữa tối & Thời gian gia đình', dinnerDuration, 'meal', null, 'Ăn tối nhẹ nhàng, tốt cho hệ vi sinh đường ruột.');
      consecutiveWorkMinutes = 0;
    }

    // Now schedule the task
    const taskDuration = task.duration;
    // Check if task fits before sleep
    if (currentTime + taskDuration > sleepTime) {
      const availableMins = sleepTime - currentTime;
      if (availableMins >= 15) {
        addItem(`Làm một phần: ${task.title}`, availableMins, 'task', task.id, `Tiến hành bước đầu của công việc (Cần thêm ${taskDuration - availableMins} phút vào hôm sau để tránh quá tải nhận thức).`);
      }
      break;
    }

    // Description generation
    let desc = task.notes || `Thực hiện công việc có mức độ ưu tiên: ${task.priority === 'high' ? 'Cao (Cần tập trung tối đa)' : task.priority === 'medium' ? 'Trung bình' : 'Thấp'}.`;
    if (task.deadline) {
      desc += ` Hạn chót y tế/công việc: ${task.deadline}.`;
    }

    addItem(task.title, taskDuration, 'task', task.id, desc);
    consecutiveWorkMinutes += taskDuration;

    // After a task, check if we want to place a break immediately if it was a very long task
    if (taskDuration >= 90) {
      addItem('Nghỉ xả hơi chủ động', preferences.breakDuration, 'break', null, 'Đi bộ nhẹ, uống nước. Vận động giúp giải phóng axit lactic tích tụ trong cơ cơ cốt lõi do ngồi lâu.');
      consecutiveWorkMinutes = 0;
    }
  }

  // C. Fill remaining time before sleep if any
  if (currentTime < sleepTime) {
    const remaining = sleepTime - currentTime;
    if (remaining >= 30) {
      addItem('Vệ sinh giấc ngủ (Sleep Hygiene)', remaining, 'routine', null, 'Ngắt hoàn toàn ánh sáng xanh từ điện thoại/máy tính để kích thích Melatonin tự nhiên, chuẩn bị cho giấc ngủ sâu phục hồi.');
    } else if (remaining > 0) {
      addItem('Nghỉ ngơi tự do cuối ngày', remaining, 'buffer', null, 'Thư giãn hoàn toàn cơ thể, hít thở sâu.');
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
  const totalWorkDuration = tasks.filter(t => !t.completed).reduce((sum, t) => sum + t.duration, 0);
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
