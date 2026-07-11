import React from 'react';
import { UserPreferences } from '../types';
import { Clock, Sliders, Coffee, Sun, Moon } from 'lucide-react';

interface PreferencesFormProps {
  preferences: UserPreferences;
  onChange: (prefs: UserPreferences) => void;
}

export default function PreferencesForm({ preferences, onChange }: PreferencesFormProps) {
  const handleChange = (field: keyof UserPreferences, value: any) => {
    onChange({
      ...preferences,
      [field]: value,
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-850 p-6 shadow-sm">
      <div className="flex items-center gap-2 pb-4 mb-5 border-b border-gray-100 dark:border-slate-800">
        <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Thiết Lập Thời Gian Biểu</h2>
      </div>

      <div className="space-y-5">
        {/* Wake up and Sleep times */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
              <Sun className="w-3.5 h-3.5 text-amber-500" /> Thức dậy
            </label>
            <input
              type="time"
              id="pref-wake"
              value={preferences.wakeUpTime}
              onChange={(e) => handleChange('wakeUpTime', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
              <Moon className="w-3.5 h-3.5 text-indigo-500" /> Đi ngủ
            </label>
            <input
              type="time"
              id="pref-sleep"
              value={preferences.sleepTime}
              onChange={(e) => handleChange('sleepTime', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Break configurations */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-gray-400" /> Làm việc liên tục
            </label>
            <select
              id="pref-interval"
              value={preferences.breakInterval}
              onChange={(e) => handleChange('breakInterval', Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 appearance-none cursor-pointer"
            >
              <option value="45" className="bg-white dark:bg-slate-900">45 phút</option>
              <option value="60" className="bg-white dark:bg-slate-900">60 phút (1 giờ)</option>
              <option value="90" className="bg-white dark:bg-slate-900">90 phút (1.5 giờ)</option>
              <option value="120" className="bg-white dark:bg-slate-900">120 phút (2 giờ)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
              <Coffee className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Thời gian giải lao
            </label>
            <select
              id="pref-duration"
              value={preferences.breakDuration}
              onChange={(e) => handleChange('breakDuration', Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 appearance-none cursor-pointer"
            >
              <option value="5" className="bg-white dark:bg-slate-900">5 phút</option>
              <option value="10" className="bg-white dark:bg-slate-900">10 phút</option>
              <option value="15" className="bg-white dark:bg-slate-900">15 phút</option>
              <option value="20" className="bg-white dark:bg-slate-900">20 phút</option>
              <option value="30" className="bg-white dark:bg-slate-900">30 phút</option>
            </select>
          </div>
        </div>

        {/* Focus style */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">
            Phong Cách Sắp Xếp Lịch Trình
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              id="style-priority"
              onClick={() => handleChange('focusStyle', 'priority')}
              className={`py-2 px-1 text-xs font-medium rounded-lg border transition-all text-center flex flex-col justify-center items-center gap-1 ${
                preferences.focusStyle === 'priority'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-300 font-semibold'
                  : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>⭐ Ưu tiên cao</span>
              <span className="text-[10px] opacity-75 font-normal">Mức độ ưu tiên</span>
            </button>
            <button
              type="button"
              id="style-deadline"
              onClick={() => handleChange('focusStyle', 'deadline')}
              className={`py-2 px-1 text-xs font-medium rounded-lg border transition-all text-center flex flex-col justify-center items-center gap-1 ${
                preferences.focusStyle === 'deadline'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-300 font-semibold'
                  : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>📅 Hạn sát trước</span>
              <span className="text-[10px] opacity-75 font-normal">Sắp hết hạn</span>
            </button>
            <button
              type="button"
              id="style-energy"
              onClick={() => handleChange('focusStyle', 'energy')}
              className={`py-2 px-1 text-xs font-medium rounded-lg border transition-all text-center flex flex-col justify-center items-center gap-1 ${
                preferences.focusStyle === 'energy'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/45 text-indigo-700 dark:text-indigo-300 font-semibold'
                  : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>⚡ Năng lượng</span>
              <span className="text-[10px] opacity-75 font-normal">Việc nặng sáng</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
