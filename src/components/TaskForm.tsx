import React, { useState } from 'react';
import { Task, Priority } from '../types';
import { Plus, Clock, Calendar, Bookmark, AlertCircle, FileText } from 'lucide-react';

interface TaskFormProps {
  onAddTask: (task: Omit<Task, 'id' | 'completed'>) => void;
}

const CATEGORIES = [
  { value: 'Lâm sàng', label: '🩺 Lâm sàng & Bệnh nhân' },
  { value: 'Công việc', label: '💼 Hành chính / Nghiên cứu' },
  { value: 'Học tập', label: '📚 Đào tạo liên tục / CME' },
  { value: 'Sức khỏe', label: '🥗 Y học Lối sống / Tập luyện' },
  { value: 'Cá nhân', label: '👤 Cá nhân' },
];

export default function TaskForm({ onAddTask }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('Lâm sàng');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startTime) return;

    onAddTask({
      title: title.trim(),
      startTime,
      endTime: endTime || undefined,
      date: date || new Date().toISOString().split('T')[0],
      priority,
      category,
      notes: notes.trim(),
    });

    // Reset form fields
    setTitle('');
    setStartTime('08:00');
    setEndTime('');
    setDate(new Date().toISOString().split('T')[0]);
    setPriority('medium');
    setNotes('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-850 p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-slate-800">
        <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-indigo-600 dark:text-indigo-400">
          <Plus className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Thêm Công Việc Mới</h2>
      </div>

      {/* Task Title */}
      <div>
        <label htmlFor="task-title" className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
          Tên công việc <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          id="task-title"
          required
          placeholder="Ví dụ: Đi buồng bệnh nhân, Đọc nghiên cứu y khoa, Tập thể dục..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
        />
      </div>

      {/* Times (Start & End) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="task-start-time" className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-gray-400" /> Giờ bắt đầu <span className="text-rose-500">*</span>
          </label>
          <input
            type="time"
            id="task-start-time"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 cursor-pointer"
          />
        </div>

        <div>
          <label htmlFor="task-end-time" className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-gray-400" /> Giờ kết thúc
          </label>
          <input
            type="time"
            id="task-end-time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 cursor-pointer"
          />
        </div>
      </div>

      {/* Date and Category */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="task-date" className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-gray-400" /> Ngày thực hiện <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            id="task-date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 cursor-pointer"
          />
        </div>

        <div>
          <label htmlFor="task-category" className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
            <Bookmark className="w-3.5 h-3.5 text-gray-400" /> Chủ đề / Nhóm
          </label>
          <select
            id="task-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 appearance-none cursor-pointer"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 text-gray-400" /> Độ ưu tiên
        </label>
        <div className="flex gap-1 bg-gray-50 dark:bg-slate-800/55 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
          {(['low', 'medium', 'high'] as Priority[]).map((p) => {
            const label = p === 'high' ? 'Cao' : p === 'medium' ? 'Vừa' : 'Thấp';
            const activeClasses = 
              p === 'high' ? 'bg-rose-500 text-white shadow-sm' :
              p === 'medium' ? 'bg-amber-500 text-white shadow-sm' :
              'bg-emerald-500 text-white shadow-sm';
            
            return (
              <button
                key={p}
                type="button"
                id={`prio-${p}`}
                onClick={() => setPriority(p)}
                className={`flex-1 py-1.5 px-1.5 text-xs font-medium rounded-lg transition-all ${
                  priority === p ? activeClasses : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-250'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="task-notes" className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
          <FileText className="w-3.5 h-3.5 text-gray-400" /> Ghi chú thêm
        </label>
        <textarea
          id="task-notes"
          rows={2}
          placeholder="Thêm mô tả ngắn, tài liệu chuẩn bị, hoặc mục tiêu cụ thể..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 resize-none"
        />
      </div>

      <button
        type="submit"
        id="btn-add-task"
        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-100 dark:shadow-none flex justify-center items-center gap-2 cursor-pointer"
      >
        <Plus className="w-4 h-4" /> Thêm công việc
      </button>
    </form>
  );
}
