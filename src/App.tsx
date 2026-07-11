import React, { useState, useEffect } from 'react';
import { Task, ScheduleItem, OptimizationSuggestion, UserPreferences } from './types';
import TaskForm from './components/TaskForm';
import PreferencesForm from './components/PreferencesForm';
import { localScheduler, timeToMinutes, minutesToTime } from './utils/scheduler';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { initAuth, googleSignIn, logout, exportScheduleToCalendar, getUserData, saveUserData, exportDatabaseToDrive, loginWithEmail, registerWithEmail } from './utils/firebase';
import {
  Calendar,
  CheckCircle2,
  Trash2,
  Brain,
  Download,
  Clock,
  Briefcase,
  AlertTriangle,
  Heart,
  Lightbulb,
  Sun,
  Coffee,
  Moon,
  Sparkles,
  RefreshCw,
  Plus,
  Compass,
  Maximize2,
  Bell,
  BellOff,
  BookOpen,
  Copy,
  Mail,
  Lock,
  Pencil,
  FileText,
  LogOut
} from 'lucide-react';

const DEFAULT_TASKS: Task[] = [
  {
    id: 't_1',
    title: 'Nghiên cứu hồ sơ & Viết báo cáo lâm sàng',
    startTime: '08:30',
    endTime: '10:00',
    date: new Date().toISOString().split('T')[0],
    priority: 'high',
    category: 'Công việc',
    notes: 'Xem lại các chỉ số xét nghiệm và hoàn thiện phác đồ hỗ trợ điều trị lối sống.',
    completed: false
  },
  {
    id: 't_2',
    title: 'Hội chẩn chuyên môn & Thiết kế bài giảng Y khoa',
    startTime: '10:30',
    endTime: '11:30',
    date: new Date().toISOString().split('T')[0],
    priority: 'medium',
    category: 'Học tập',
    notes: 'Thảo luận cùng đồng nghiệp về nhịp sinh học và thiết kế slide dinh dưỡng phòng ngừa.',
    completed: false
  },
  {
    id: 't_3',
    title: 'Cập nhật nghiên cứu Y văn mới (PubMed)',
    startTime: '14:00',
    endTime: '14:45',
    date: new Date().toISOString().split('T')[0],
    priority: 'medium',
    category: 'Học tập',
    notes: 'Đọc thêm các bài báo về ảnh hưởng của cortisol ban ngày và vệ sinh giấc ngủ ban đêm.',
    completed: false
  },
  {
    id: 't_4',
    title: 'Vận động thể chất Aerobic nâng cao nhịp tim',
    startTime: '17:00',
    endTime: '17:40',
    date: new Date().toISOString().split('T')[0],
    priority: 'low',
    category: 'Sức khỏe',
    notes: 'Đi bộ nhanh hoặc đạp xe nhẹ giúp điều hòa huyết áp, giảm căng thẳng vỏ não.',
    completed: false
  }
];

const DEFAULT_PREFERENCES: UserPreferences = {
  wakeUpTime: '07:30',
  sleepTime: '23:00',
  breakInterval: 60,
  breakDuration: 10,
  focusStyle: 'priority',
  showCompletedInSchedule: true
};

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('planner_tasks');
    return saved ? JSON.parse(saved) : DEFAULT_TASKS;
  });

  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const saved = localStorage.getItem('planner_preferences');
    return saved ? JSON.parse(saved) : DEFAULT_PREFERENCES;
  });

  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [dailyQuote, setDailyQuote] = useState('Hành trình vạn dặm bắt đầu từ một bước chân nhỏ bé.');
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('planner_dark_mode') === 'true';
  });
  const [showGuide, setShowGuide] = useState(false);

  // Edit/delete schedule and tasks states
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingScheduleItem, setEditingScheduleItem] = useState<ScheduleItem | null>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('planner_dark_mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('planner_dark_mode', 'false');
    }
  }, [isDarkMode]);

  // Google Calendar States
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  // Google Drive States
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [driveSuccessMessage, setDriveSuccessMessage] = useState<string | null>(null);
  const [driveErrorMessage, setDriveErrorMessage] = useState<string | null>(null);

  // Reminder / Notification States
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(() => {
    return localStorage.getItem('planner_notifications_enabled') === 'true';
  });
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [activeToast, setActiveToast] = useState<{ title: string; message: string; type: string } | null>(null);
  const [firedAlerts, setFiredAlerts] = useState<string[]>([]);
  const [showCalendarPrompt, setShowCalendarPrompt] = useState(false);

  // Floating Login Form States
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Audio synthesize chime
  const playChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playNote = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(start);
        osc.stop(start + duration);
      };

      const now = ctx.currentTime;
      playNote(523.25, now, 0.8); // C5
      playNote(659.25, now + 0.15, 0.8); // E5
      playNote(783.99, now + 0.3, 1.2); // G5
    } catch (err) {
      console.warn('Audio chime error:', err);
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
      if (result === 'granted') {
        setIsNotificationsEnabled(true);
        localStorage.setItem('planner_notifications_enabled', 'true');
        showLocalNotification('Thông báo được kích hoạt! 🔔', 'Bạn sẽ nhận được các nhắc nhở nhịp sinh học và công việc cá nhân.');
        playChime();
      } else {
        setIsNotificationsEnabled(false);
        localStorage.setItem('planner_notifications_enabled', 'false');
      }
    } catch (err) {
      console.warn('Permission request error:', err);
    }
  };

  const handleToggleNotifications = async () => {
    if (isNotificationsEnabled) {
      setIsNotificationsEnabled(false);
      localStorage.setItem('planner_notifications_enabled', 'false');
      setActiveToast({
        title: "Đã tắt nhắc nhở 🔕",
        message: "Bạn đã tắt âm thanh và cửa sổ thông báo nhịp sinh học tự động.",
        type: "info"
      });
    } else {
      if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
          setIsNotificationsEnabled(true);
          localStorage.setItem('planner_notifications_enabled', 'true');
          showLocalNotification('Thông báo được kích hoạt! 🔔', 'Bạn sẽ nhận được các nhắc nhở nhịp sinh học và công việc cá nhân.');
          playChime();
        } else if (Notification.permission === 'denied') {
          setActiveToast({
            title: "Quyền thông báo bị chặn 🚫",
            message: "Bạn đã chặn quyền thông báo trên trình duyệt. Hãy cho phép trong cài đặt trình duyệt để nhận cửa sổ nhắc nhở nổi, hoặc chúng tôi sẽ dùng thông báo tạm thời trong ứng dụng.",
            type: "warning"
          });
          setIsNotificationsEnabled(true);
          localStorage.setItem('planner_notifications_enabled', 'true');
          playChime();
        } else {
          await requestNotificationPermission();
        }
      } else {
        setIsNotificationsEnabled(true);
        localStorage.setItem('planner_notifications_enabled', 'true');
        setActiveToast({
          title: "Thông báo nổi không hỗ trợ 🔔",
          message: "Trình duyệt của bạn không hỗ trợ Thông báo nổi, ứng dụng sẽ sử dụng âm thanh báo và thông báo tạm trong app.",
          type: "info"
        });
        playChime();
      }
    }
  };

  const showLocalNotification = (title: string, body: string, type = 'info') => {
    setActiveToast({ title, message: body, type });
    // Clear toast in 8 seconds
    setTimeout(() => {
      setActiveToast(prev => prev && prev.title === title ? null : prev);
    }, 8000);

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && isNotificationsEnabled) {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: 'clinic-flow-reminder'
        });
      } catch (e) {
        console.warn('Browser Notification failed inside iframe:', e);
      }
    }
  };

  // Background check for notifications & alerts
  useEffect(() => {
    const checkScheduleReminders = () => {
      if (!isNotificationsEnabled || schedule.length === 0) return;

      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTotalMins = currentHours * 60 + currentMinutes;
      const todayDateStr = now.toISOString().split('T')[0];

      schedule.forEach(item => {
        const [itemHours, itemMins] = item.startTime.split(':').map(Number);
        const itemTotalMins = itemHours * 60 + itemMins;

        // 1. Starting right now
        if (currentTotalMins === itemTotalMins) {
          const alertKey = `${todayDateStr}_${item.startTime}_${item.activity}_start`;
          if (!firedAlerts.includes(alertKey)) {
            setFiredAlerts(prev => [...prev, alertKey]);
            showLocalNotification(
              `⏰ Bắt đầu: ${item.activity}`,
              item.description || 'Đã đến giờ thực hiện hoạt động này theo lịch trình sinh học.',
              'start'
            );
            playChime();
          }
        }

        // 2. Starting in 5 minutes (Pre-alert warning)
        if (itemTotalMins - currentTotalMins === 5) {
          const alertKey = `${todayDateStr}_${item.startTime}_${item.activity}_pre`;
          if (!firedAlerts.includes(alertKey)) {
            setFiredAlerts(prev => [...prev, alertKey]);
            showLocalNotification(
              `🕒 Sắp diễn ra: ${item.activity}`,
              `Bắt đầu sau 5 phút nữa (${item.startTime}). Hãy chuẩn bị sẵn sàng và sạc lại năng lượng!`,
              'pre'
            );
            playChime();
          }
        }
      });
    };

    checkScheduleReminders();
    const interval = setInterval(checkScheduleReminders, 20000);
    return () => clearInterval(interval);
  }, [schedule, isNotificationsEnabled, firedAlerts]);

  // Firestore synchronization states
  const [isDataLoadedFromFirestore, setIsDataLoadedFromFirestore] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setIsDataLoadedFromFirestore(false);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Load tasks and preferences instantly based on active user/guest account
  useEffect(() => {
    const keySuffix = user ? user.uid : 'guest';
    const localTasksJson = localStorage.getItem(`planner_tasks_${keySuffix}`);
    const localPrefsJson = localStorage.getItem(`planner_preferences_${keySuffix}`);

    let initialTasks = DEFAULT_TASKS;
    let initialPrefs = DEFAULT_PREFERENCES;

    if (localTasksJson) {
      try {
        initialTasks = JSON.parse(localTasksJson);
      } catch (e) {
        console.error('Error parsing isolated local tasks:', e);
      }
    } else if (!user) {
      // For backward compatibility with previous single-user guest state
      const legacyTasks = localStorage.getItem('planner_tasks');
      if (legacyTasks) {
        try {
          initialTasks = JSON.parse(legacyTasks);
        } catch (e) {}
      }
    }

    if (localPrefsJson) {
      try {
        initialPrefs = JSON.parse(localPrefsJson);
      } catch (e) {
        console.error('Error parsing isolated local preferences:', e);
      }
    } else if (!user) {
      // For backward compatibility with previous single-user guest state
      const legacyPrefs = localStorage.getItem('planner_preferences');
      if (legacyPrefs) {
        try {
          initialPrefs = JSON.parse(legacyPrefs);
        } catch (e) {}
      }
    }

    setTasks(initialTasks);
    setPreferences(initialPrefs);
    setIsDataLoadedFromFirestore(false);
    handleOptimize(initialTasks, initialPrefs);
  }, [user]);

  // Sync user tasks and preferences from Firestore
  useEffect(() => {
    if (!user) {
      setIsDataLoadedFromFirestore(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const onlineData = await getUserData(user.uid);
        if (onlineData) {
          setTasks(onlineData.tasks);
          if (onlineData.preferences) {
            setPreferences(onlineData.preferences);
          }
          // Sync immediately to specific user's local storage backup
          localStorage.setItem(`planner_tasks_${user.uid}`, JSON.stringify(onlineData.tasks));
          if (onlineData.preferences) {
            localStorage.setItem(`planner_preferences_${user.uid}`, JSON.stringify(onlineData.preferences));
          }
          setIsDataLoadedFromFirestore(true);
          // Run optimize with loaded data
          handleOptimize(onlineData.tasks, onlineData.preferences || preferences);
          
          // Ask user if they want to integrate Google Calendar (if they haven't seen it yet)
          const hasBeenPrompted = localStorage.getItem(`planner_prompted_calendar_${user.uid}`);
          if (hasBeenPrompted !== 'true') {
            setShowCalendarPrompt(true);
          }
        } else {
          // First time logging in, initialize Firestore with the active local state for this user (which has fallback to DEFAULT_TASKS already)
          await saveUserData(user.uid, { tasks, preferences });
          setIsDataLoadedFromFirestore(true);
          
          // Show Calendar Integration request modal/prompt
          setShowCalendarPrompt(true);
        }
      } catch (err) {
        console.error('Error syncing with Firestore:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleEmailLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      setLoginError('Vui lòng nhập đầy đủ địa chỉ Gmail và mật khẩu.');
      return;
    }

    if (!emailInput.toLowerCase().endsWith('@gmail.com') && !emailInput.includes('@')) {
      setLoginError('Vui lòng nhập địa chỉ Gmail hợp lệ (Ví dụ: bacsi.huyen@gmail.com).');
      return;
    }

    if (passwordInput.length < 6) {
      setLoginError('Mật khẩu phải có độ dài tối thiểu 6 ký tự để bảo mật tài khoản.');
      return;
    }

    setIsLoginLoading(true);
    setLoginError(null);
    try {
      if (authMode === 'login') {
        try {
          const loggedInUser = await loginWithEmail(emailInput, passwordInput);
          setUser(loggedInUser);
          setAccessToken(null);
          saveUserData(loggedInUser.uid, { tasks, preferences });
          
          showLocalNotification(
            'Đăng nhập thành công! 🎉',
            `Chào mừng quay trở lại, ${loggedInUser.email || 'Bác sĩ'}! Đừng quên đồng bộ lịch trình sinh học sang Google Calendar cá nhân nhé.`,
            'success'
          );
        } catch (authErr: any) {
          const code = authErr.code || '';
          if (code === 'auth/user-not-found') {
            setLoginError('Tài khoản Gmail này chưa được đăng ký. Vui lòng nhấp vào tab "Đăng ký tài khoản" bên trên để tạo tài khoản mới.');
          } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
            setLoginError('Mật khẩu không chính xác. Vui lòng nhập lại hoặc chọn tài khoản khác.');
          } else if (code === 'auth/operation-not-allowed') {
            // Configuration disabled on Firebase Console, fallback to gorgeous simulation
            throw authErr;
          } else {
            setLoginError(`Lỗi đăng nhập: ${authErr.message || authErr}`);
          }
        }
      } else {
        // Register mode
        try {
          const registeredUser = await registerWithEmail(emailInput, passwordInput);
          setUser(registeredUser);
          setAccessToken(null);
          saveUserData(registeredUser.uid, { tasks, preferences });
          
          showLocalNotification(
            'Đăng ký tài khoản thành công! 📝',
            'Tài khoản mới đã được kích hoạt. Bạn có thể sử dụng đầy đủ tính năng lưu trữ và đồng bộ Google Calendar hằng ngày!',
            'success'
          );
        } catch (authErr: any) {
          const code = authErr.code || '';
          if (code === 'auth/email-already-in-use') {
            setLoginError('Địa chỉ Gmail này đã được đăng ký trước đó. Vui lòng chuyển sang tab "Đăng nhập" để tiếp tục.');
          } else if (code === 'auth/weak-password') {
            setLoginError('Mật khẩu quá yếu. Vui lòng chọn mật khẩu bảo mật có tối thiểu 6 ký tự.');
          } else if (code === 'auth/operation-not-allowed') {
            // Configuration disabled on Firebase Console, fallback to gorgeous simulation
            throw authErr;
          } else {
            setLoginError(`Lỗi đăng ký: ${authErr.message || authErr}`);
          }
        }
      }
    } catch (err: any) {
      console.warn('Firebase Email auth is disabled or misconfigured. Falling back to clean profile simulation:', err);
      // Fallback for robust operations in environments where Email provider might be disabled in Firebase Console
      const simulatedUser = {
        uid: 'local_' + btoa(emailInput).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15),
        email: emailInput,
        displayName: emailInput.split('@')[0]
      };
      setUser(simulatedUser);
      setAccessToken(null);
      
      showLocalNotification(
        'Đăng nhập thành công (Mô phỏng)! 🎉',
        `Đã kết nối hồ sơ cho ${emailInput}. Hãy nhấp "Đồng bộ Calendar" ở góc trên để liên kết và đưa lịch trình sinh học vào Google Calendar cá nhân của bạn!`,
        'success'
      );
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setSyncErrorMessage(null);
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        
        showLocalNotification(
          'Đăng nhập Google thành công! 🎉',
          'Tài khoản Google đã kết nối. Hãy nhấp "Đồng bộ Calendar" để cập nhật phác đồ sinh học vào lịch cá nhân của bạn!',
          'success'
        );
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMsg = err.message || '';
      const errorCode = err.code || '';
      
      if (errorCode === 'auth/unauthorized-domain' || errorMsg.includes('unauthorized-domain') || errorMsg.includes('unauthorized partner domain')) {
        setSyncErrorMessage('Đăng nhập nhanh bằng Google chưa khả dụng do tên miền chưa được cấu hình trên Firebase Console. Vui lòng sử dụng tính năng Đăng nhập / Đăng ký Gmail bên dưới.');
      } else {
        setSyncErrorMessage('Kết nối Google Calendar thất bại: ' + (err.message || err));
      }
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setAccessToken(null);
      setSyncSuccessMessage(null);
      setSyncErrorMessage(null);
      setDriveSuccessMessage(null);
      setDriveErrorMessage(null);
      setShowCalendarPrompt(false);
      
      // Reset tasks and preferences to default initial values
      setTasks(DEFAULT_TASKS);
      setPreferences(DEFAULT_PREFERENCES);
      
      // Clear localStorage cache for both guest and specific users to ensure pristine default state
      localStorage.removeItem('planner_tasks');
      localStorage.removeItem('planner_preferences');
      localStorage.removeItem('planner_tasks_guest');
      localStorage.removeItem('planner_preferences_guest');
      if (user) {
        localStorage.removeItem(`planner_tasks_${user.uid}`);
        localStorage.removeItem(`planner_preferences_${user.uid}`);
      }
      
      // Re-optimize with fresh defaults
      handleOptimize(DEFAULT_TASKS, DEFAULT_PREFERENCES);

      // Reset floating form states
      setEmailInput('');
      setPasswordInput('');
      setIsOfflineMode(false);

      setActiveToast({
        title: "Đã đăng xuất tài khoản! 🚪",
        message: "Hệ thống đã được khôi phục về phác đồ sinh học và cài đặt mặc định ban đầu.",
        type: "info"
      });
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const handleExportToGoogleCalendar = async () => {
    if (!accessToken) {
      handleGoogleLogin();
      return;
    }

    if (schedule.length === 0) {
      setSyncErrorMessage('Không có lịch trình hoạt động nào để xuất.');
      return;
    }

    const confirmed = window.confirm(
      `Đồng ý thêm ${schedule.length} sự kiện sinh học và công việc của lịch trình hôm nay vào Google Calendar của bạn?`
    );
    if (!confirmed) return;

    setIsSyncing(true);
    setSyncSuccessMessage(null);
    setSyncErrorMessage(null);

    try {
      const result = await exportScheduleToCalendar(schedule, accessToken);
      if (result.success) {
        setSyncSuccessMessage(`Đã đồng bộ thành công ${result.createdCount} hoạt động vào Google Calendar!`);
        // Mark that calendar integration has been prompted and accepted
        if (user) {
          localStorage.setItem(`planner_prompted_calendar_${user.uid}`, 'true');
          setShowCalendarPrompt(false);
        }
        setTimeout(() => setSyncSuccessMessage(null), 8000);
      } else {
        setSyncErrorMessage(`Lỗi đồng bộ: ${result.error}`);
      }
    } catch (err: any) {
      setSyncErrorMessage(`Đồng bộ thất bại: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBackupToGoogleDrive = async () => {
    if (!accessToken || !user) {
      handleGoogleLogin();
      return;
    }

    setIsDriveSyncing(true);
    setDriveSuccessMessage(null);
    setDriveErrorMessage(null);

    try {
      const dataToBackup = {
        tasks,
        preferences,
        schedule
      };
      const result = await exportDatabaseToDrive(dataToBackup, accessToken, user.email || 'user');
      if (result.success) {
        setDriveSuccessMessage('Đã sao lưu cơ sở dữ liệu thành công lên Google Drive trong thư mục dùng chung!');
        setTimeout(() => setDriveSuccessMessage(null), 8000);
      } else {
        setDriveErrorMessage(`Lỗi sao lưu Drive: ${result.error}`);
      }
    } catch (err: any) {
      setDriveErrorMessage(`Lỗi sao lưu: ${err.message || err}`);
    } finally {
      setIsDriveSyncing(false);
    }
  };

  // Save state to localStorage and Firestore (if logged in)
  useEffect(() => {
    const keySuffix = user ? user.uid : 'guest';
    localStorage.setItem(`planner_tasks_${keySuffix}`, JSON.stringify(tasks));
    if (!user) {
      localStorage.setItem('planner_tasks', JSON.stringify(tasks));
    }
    if (user && isDataLoadedFromFirestore) {
      saveUserData(user.uid, { tasks, preferences });
    }
  }, [tasks, user, isDataLoadedFromFirestore]);

  useEffect(() => {
    const keySuffix = user ? user.uid : 'guest';
    localStorage.setItem(`planner_preferences_${keySuffix}`, JSON.stringify(preferences));
    if (!user) {
      localStorage.setItem('planner_preferences', JSON.stringify(preferences));
    }
    if (user && isDataLoadedFromFirestore) {
      saveUserData(user.uid, { tasks, preferences });
    }
  }, [preferences, user, isDataLoadedFromFirestore]);

  // Request optimized schedule from server API
  const handleOptimize = async (currentTasks = tasks, currentPrefs = preferences) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/optimize-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: currentTasks,
          preferences: currentPrefs
        })
      });

      if (!response.ok) {
        throw new Error('Không thể kết nối đến máy chủ AI để lập lịch.');
      }

      const data = await response.json();
      setSchedule(data.schedule || []);
      setSuggestions(data.suggestions || []);
      setDailyQuote(data.dailyQuote || '');
      setIsAiGenerated(data.isAiGenerated || false);
    } catch (error) {
      console.warn('Lỗi khi gọi API AI, chuyển sang lập lịch cục bộ:', error);
      // Fallback
      const fallback = localScheduler(currentTasks, currentPrefs);
      setSchedule(fallback.schedule);
      setSuggestions(fallback.suggestions);
      setDailyQuote(fallback.dailyQuote);
      setIsAiGenerated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Run initial optimization once when mounted
  useEffect(() => {
    handleOptimize(tasks, preferences);
  }, []);

  const handleAddTask = (newTaskData: Omit<Task, 'id' | 'completed'>) => {
    const newTask: Task = {
      ...newTaskData,
      id: `task_${Date.now()}`,
      completed: false
    };
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    handleOptimize(updatedTasks, preferences);
  };

  const handleToggleTask = (id: string) => {
    const updatedTasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTasks(updatedTasks);
    // Re-optimize schedule with remaining tasks ONLY if we hide completed tasks in schedule
    if (preferences.showCompletedInSchedule === false) {
      handleOptimize(updatedTasks, preferences);
    }
  };

  const handleToggleShowCompletedInSchedule = () => {
    const newPrefs: UserPreferences = {
      ...preferences,
      showCompletedInSchedule: preferences.showCompletedInSchedule !== false ? false : true
    };
    setPreferences(newPrefs);
    handleOptimize(tasks, newPrefs);
  };

  const handleDeleteTask = (id: string) => {
    const updatedTasks = tasks.filter(t => t.id !== id);
    setTasks(updatedTasks);
    handleOptimize(updatedTasks, preferences);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    const updated = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    setTasks(updated);
    setEditingTask(null);
    handleOptimize(updated, preferences);
    setActiveToast({
      title: "Cập nhật công việc thành công! 📝",
      message: `Công việc "${updatedTask.title}" đã được lưu chỉnh sửa và phân bổ lại lịch trình sinh học.`,
      type: "success"
    });
  };

  const handleUpdateScheduleItem = (updatedItem: ScheduleItem) => {
    // 1. Calculate duration based on startTime and endTime safely
    const startMins = timeToMinutes(updatedItem.startTime);
    let endMins = timeToMinutes(updatedItem.endTime);
    if (endMins < startMins) {
      endMins += 1440; // overnight wrap
    }
    const computedDuration = endMins - startMins;

    const updatedWithTimeSlot: ScheduleItem = {
      ...updatedItem,
      timeSlot: `${updatedItem.startTime} - ${updatedItem.endTime}`,
      duration: computedDuration > 0 ? computedDuration : updatedItem.duration
    };

    // 2. Map updated item into schedule list
    const updated = schedule.map(item => item.id === updatedItem.id ? updatedWithTimeSlot : item);
    setSchedule(updated);

    // 3. Sync changes back to underlying task in the task list if applicable
    if (updatedItem.type === 'task' && updatedItem.taskId) {
      const updatedTasks = tasks.map(t => {
        if (t.id === updatedItem.taskId) {
          return {
            ...t,
            title: updatedItem.activity,
            startTime: updatedItem.startTime,
            endTime: updatedItem.endTime,
            notes: updatedItem.description || t.notes
          };
        }
        return t;
      });
      setTasks(updatedTasks);
    }

    setEditingScheduleItem(null);
    setActiveToast({
      title: "Đã cập nhật lịch trình! ⏰",
      message: `Hoạt động "${updatedItem.activity}" đã được cập nhật và đồng bộ với danh sách công việc.`,
      type: "success"
    });
  };

  const handleDeleteScheduleItem = (itemId: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa hoạt động này khỏi lịch trình sinh học hôm nay?')) {
      const itemToDelete = schedule.find(item => item.id === itemId);
      
      // If it is a task and has a taskId, delete it from the task list too
      if (itemToDelete && itemToDelete.type === 'task' && itemToDelete.taskId) {
        const updatedTasks = tasks.filter(t => t.id !== itemToDelete.taskId);
        setTasks(updatedTasks);
      }

      const updated = schedule.filter(item => item.id !== itemId);
      setSchedule(updated);
      setActiveToast({
        title: "Đã xóa khỏi lịch trình! 🗑️",
        message: "Hoạt động đã được gỡ bỏ và đồng bộ khỏi danh sách hôm nay.",
        type: "success"
      });
    }
  };

  const handleUpdatePreferences = (newPrefs: UserPreferences) => {
    setPreferences(newPrefs);
    handleOptimize(tasks, newPrefs);
  };

  // Divide schedule items into Sáng (Morning), Chiều (Afternoon), Tối (Evening)
  const getCategorizedSchedule = () => {
    const morning: ScheduleItem[] = [];
    const afternoon: ScheduleItem[] = [];
    const evening: ScheduleItem[] = [];

    schedule.forEach(item => {
      const startTimeStr = item.startTime || '08:00';
      const parts = startTimeStr.split(':');
      const startHour = parts.length > 0 ? parseInt(parts[0], 10) : 8;
      const validHour = isNaN(startHour) ? 8 : startHour;
      if (validHour < 12) {
        morning.push(item);
      } else if (validHour >= 12 && validHour < 18) {
        afternoon.push(item);
      } else {
        evening.push(item);
      }
    });

    return { morning, afternoon, evening };
  };

  const { morning, afternoon, evening } = getCategorizedSchedule();
 
  // Custom PDF/Print generation with iframe compatibility fallback
  const handlePrint = () => {
    // Try to trigger standard browser print dialog
    try {
      window.print();
    } catch (err) {
      console.warn('Browser print failed, likely due to iframe sandbox restriction:', err);
    }

    // Generate a beautiful, standalone, offline-ready printable HTML document and download it
    const dateStr = getFormattedDate();
    const userStr = user ? user.email : 'Người dùng Clinic Flow';
    const efficiency = tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0;
    const completedText = `${tasks.filter(t => t.completed).length} / ${tasks.length}`;
    const breakText = `${preferences.breakDuration} phút / mỗi ${preferences.breakInterval} phút`;

    // Build the schedule rows
    const scheduleRows = schedule.map(item => {
      // Color coding for different activity types
      let typeBg = '#f1f5f9';
      let typeText = '#475569';
      let typeBorder = '#e2e8f0';

      const typeLower = item.type.toLowerCase();
      if (typeLower.includes('dinh dưỡng') || typeLower.includes('ăn') || typeLower.includes('uống')) {
        typeBg = '#f0fdf4';
        typeText = '#166534';
        typeBorder = '#bbf7d0';
      } else if (typeLower.includes('vận động') || typeLower.includes('tập') || typeLower.includes('thể thao')) {
        typeBg = '#f0f9ff';
        typeText = '#0369a1';
        typeBorder = '#bae6fd';
      } else if (typeLower.includes('giấc ngủ') || typeLower.includes('ngủ') || typeLower.includes('nghỉ')) {
        typeBg = '#faf5ff';
        typeText = '#6b21a8';
        typeBorder = '#e9d5ff';
      } else if (typeLower.includes('y khoa') || typeLower.includes('khám') || typeLower.includes('thuốc')) {
        typeBg = '#fff1f2';
        typeText = '#9f1239';
        typeBorder = '#fecdd3';
      } else if (typeLower.includes('thư giãn') || typeLower.includes('thiền')) {
        typeBg = '#fdf4ff';
        typeText = '#86198f';
        typeBorder = '#f5d0fe';
      }

      return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 14px 12px; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13px; font-weight: 700; color: #0f172a; width: 130px; text-align: center; background-color: #f8fafc; border-right: 1px solid #e2e8f0;">
          ${item.startTime} - ${item.endTime}
        </td>
        <td style="padding: 14px 16px;">
          <div style="font-size: 14px; font-weight: 700; color: #0f172a; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="font-family: 'Inter', sans-serif;">${item.activity}</span>
            <span style="font-size: 10px; font-weight: 700; color: ${typeText}; background-color: ${typeBg}; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; border: 1px solid ${typeBorder}; display: inline-block; white-space: nowrap; letter-spacing: 0.05em;">
              ${item.type}
            </span>
          </div>
          <div style="font-size: 12.5px; color: #475569; margin-top: 6px; font-family: 'Inter', sans-serif; line-height: 1.5;">
            ${item.description}
          </div>
        </td>
      </tr>
      `;
    }).join('');

    // Build suggestions
    const suggestionItems = suggestions.slice(0, 4).map(sug => `
      <div style="padding: 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; display: flex; flex-direction: column; gap: 6px;">
        <h4 style="font-size: 13px; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 6px; font-family: 'Inter', sans-serif;">
          <span style="color: #4f46e5;">✦</span> ${sug.title}
        </h4>
        <p style="font-size: 12px; color: #475569; margin: 0; line-height: 1.6; font-family: 'Inter', sans-serif;">${sug.content}</p>
      </div>
    `).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Phác đồ Nhịp sinh học - Clinic Flow</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    @media print {
      @page {
        size: A4;
        margin: 15mm 20mm 20mm 20mm;
      }
      body {
        padding: 0 !important;
        background-color: #ffffff !important;
      }
      .print-banner {
        display: none !important;
      }
      .page-break {
        page-break-before: always;
      }
    }
    
    body {
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      line-height: 1.5;
      padding: 40px;
      max-width: 840px;
      margin: 0 auto;
      background-color: #f8fafc;
    }

    .paper-container {
      background-color: #ffffff;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }

    @media print {
      body {
        background-color: transparent;
      }
      .paper-container {
        padding: 0;
        border-radius: 0;
        box-shadow: none;
        border: none;
      }
    }

    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 20px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo-area {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .logo-icon {
      background-color: #f5f3ff;
      border-radius: 12px;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid #e0e7ff;
    }

    .logo-title h1 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.04em;
      margin: 0;
      color: #0f172a;
      line-height: 1.1;
    }

    .logo-title p {
      font-size: 9px;
      color: #6366f1;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin: 2px 0 0 0;
    }

    .meta-info {
      text-align: right;
      font-size: 12px;
      color: #475569;
    }

    .meta-info p {
      margin: 4px 0;
    }

    .quote {
      padding: 16px 20px;
      background-color: #f5f3ff;
      border-left: 4px solid #6366f1;
      border-radius: 4px 12px 12px 4px;
      font-style: italic;
      font-size: 13px;
      color: #4338ca;
      margin-bottom: 28px;
      line-height: 1.6;
      font-weight: 500;
    }

    .metrics {
      display: grid;
      grid-template-cols: repeat(3, 1fr);
      gap: 16px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      background-color: #f8fafc;
      margin-bottom: 28px;
    }

    .metric-card p {
      margin: 0;
    }

    .metric-title {
      font-size: 10px;
      color: #64748b;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .metric-value {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 6px !important;
    }

    .schedule-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 32px;
    }

    .schedule-table th {
      text-align: left;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #475569;
      border-bottom: 2px solid #cbd5e1;
      padding-bottom: 10px;
      background-color: transparent;
    }

    .suggestions-section {
      margin-top: 36px;
      border-top: 1px solid #e2e8f0;
      padding-top: 24px;
    }

    .suggestions-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #0f172a;
      margin: 0 0 16px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .suggestions-grid {
      display: grid;
      grid-template-cols: 1fr 1fr;
      gap: 16px;
    }

    .footer {
      margin-top: 50px;
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      font-size: 10.5px;
      color: #64748b;
      line-height: 1.6;
    }

    .footer-left p, .footer-right p {
      margin: 2px 0;
    }

    .signature-area {
      margin-top: 40px;
      display: flex;
      justify-content: flex-end;
    }

    .signature-box {
      text-align: center;
      width: 220px;
    }

    .signature-title {
      font-size: 9.5px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.08em;
      margin-bottom: 40px;
    }

    .signature-line {
      border-bottom: 1.5px solid #cbd5e1;
      margin-bottom: 6px;
    }

    .signature-name {
      font-size: 11.5px;
      font-weight: 700;
      color: #1e293b;
    }

    .print-banner {
      background-color: #f5f3ff;
      border: 1px dashed #c084fc;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .print-banner-text {
      font-size: 12px;
      color: #581c87;
      margin: 0;
      line-height: 1.5;
    }

    .print-button {
      background-color: #6366f1;
      color: white;
      border: none;
      padding: 9px 18px;
      font-size: 12.5px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
      box-shadow: 0 2px 6px rgba(99, 102, 241, 0.2);
    }

    .print-button:hover {
      background-color: #4f46e5;
      transform: translateY(-1px);
    }
  </style>
</head>
<body>
  <div class="print-banner">
    <p class="print-banner-text">
      <strong>💡 Gợi ý hữu ích:</strong> File phác đồ này đã được thiết lập tối ưu để in ấn trên khổ giấy A4 hoặc Lưu PDF. Hãy nhấn nút bên cạnh để tiến hành in / lưu.
    </p>
    <button class="print-button" onclick="window.print()">
      🖨️ Tiến hành In / Lưu PDF
    </button>
  </div>

  <div class="paper-container">
    <div class="header">
      <div class="logo-area">
        <div class="logo-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 10.5V13.5M12 5V19M5 12H19" stroke="#6366f1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 12M12 12" stroke="#10b981" stroke-width="4" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="logo-title">
          <h1>CLINIC FLOW</h1>
          <p>Lifestyle Medicine & Circadian Optimization</p>
        </div>
      </div>
      <div class="meta-info">
        <p>Phác đồ lập ngày: <strong>${dateStr}</strong></p>
        <p>Hồ sơ bác sĩ / Bệnh nhân: <strong>${userStr}</strong></p>
      </div>
    </div>

    <div class="quote">
      &ldquo;${dailyQuote}&rdquo;
    </div>

    <div class="metrics">
      <div class="metric-card">
        <p class="metric-title">Chỉ số hoàn thành</p>
        <p class="metric-value" style="color: #4f46e5;">${efficiency}% hiệu suất</p>
      </div>
      <div class="metric-card">
        <p class="metric-title">Nhiệm vụ sinh học</p>
        <p class="metric-value" style="color: #10b981;">Đã thực hiện: ${completedText}</p>
      </div>
      <div class="metric-card">
        <p class="metric-title">Cấu hình nghỉ ngơi</p>
        <p class="metric-value" style="color: #0f172a;">${breakText}</p>
      </div>
    </div>

    <table class="schedule-table">
      <thead>
        <tr>
          <th style="width: 130px; text-align: center; padding-bottom: 10px;">Khung Giờ</th>
          <th style="padding-left: 16px; padding-bottom: 10px;">Chi tiết lịch trình tối ưu hóa sinh học</th>
        </tr>
      </thead>
      <tbody>
        ${scheduleRows}
      </tbody>
    </table>

    ${suggestions.length > 0 ? `
    <div class="suggestions-section">
      <h3 class="suggestions-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: #6366f1; display: inline-block; vertical-align: middle;">
          <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Chỉ Định Lâm Sàng & Gợi Ý Y Học Lối Sống
      </h3>
      <div class="suggestions-grid">
        ${suggestionItems}
      </div>
    </div>
    ` : ''}

    <div class="signature-area">
      <div class="signature-box">
        <p class="signature-title">Xác nhận lâm sàng</p>
        <div class="signature-line"></div>
        <p class="signature-name">Clinic Flow AI Companion</p>
      </div>
    </div>

    <div class="footer">
      <div class="footer-left">
        <p><strong>🏥 Clinic Flow Lifestyle Medicine Alliance</strong></p>
        <p>Hệ thống hỗ trợ lập phác đồ tự động và điều chỉnh thói quen chuẩn lâm sàng.</p>
        <p>Webapp phát triển bởi Dr Huyền Vũ • Email: bshuyenvuvl@gmail.com</p>
      </div>
      <div class="footer-right" style="text-align: right;">
        <p><strong>TÀI LIỆU Y KHOA NỘI BỘ</strong></p>
        <p>Mã bệnh án điện tử: CF-MED-${user ? user.uid.substring(0, 8).toUpperCase() : 'GUEST'}</p>
        <p>Bản in này được bảo vệ quyền riêng tư bởi tiêu chuẩn y tế Clinic Flow.</p>
      </div>
    </div>
  </div>

  <script>
    // Auto-trigger print when opened
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>
    `;

    // Download file
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `clinic_flow_lich_trinh_${new Date().toISOString().slice(0, 10)}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Show dynamic in-app toast
    setActiveToast({
      title: "Đang in & Xuất bản PDF 🖨️",
      message: "Hộp thoại in đã được gọi. Đồng thời file 'clinic_flow_lich_trinh.html' đã được tải xuống. Hãy mở file này để In hoặc Lưu PDF cực kỳ sắc nét!",
      type: "success"
    });
  };

  // Get current date string formatted nicely in Vietnamese
  const getFormattedDate = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('vi-VN', options);
  };

  return (
    <>
      {/* FLOATING GMAIL LOGIN FORM MODAL */}
      {!user && !isOfflineMode && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn print:hidden">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 md:p-8 relative overflow-hidden flex flex-col gap-4 max-h-[95vh] overflow-y-auto">
            
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
            
            <div className="text-center space-y-1 pt-1">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-xs">
                <Brain className="w-5.5 h-5.5 animate-pulse" />
              </div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white uppercase mt-2">Clinic Flow Planner</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal px-2">
                Kết nối tài khoản Gmail của bạn để lưu phác đồ sinh học lâu dài và đồng bộ lịch trình cá nhân hằng ngày.
              </p>
            </div>

            {/* Segmented Control Tabs */}
            <div className="grid grid-cols-2 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-150 dark:border-slate-850/50">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setLoginError(null); }}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authMode === 'login' 
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setLoginError(null); }}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authMode === 'register' 
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                Đăng ký mới
              </button>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium leading-tight">{loginError}</span>
              </div>
            )}

            <form onSubmit={handleEmailLoginSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Tài khoản Gmail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="vi_du_cua_ban@gmail.com"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Mật khẩu</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Mật khẩu của bạn (ít nhất 6 ký tự)"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all"
                  />
                </div>
                <p className="text-[9px] text-slate-400 italic">
                  {authMode === 'login' 
                    ? 'Nhập mật khẩu Gmail bạn đã đăng ký trên hệ thống.' 
                    : 'Đặt mật khẩu bảo mật (tối thiểu 6 ký tự) cho tài khoản mới.'
                  }
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoginLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isLoginLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Đang xử lý...
                  </>
                ) : authMode === 'login' ? (
                  'Đăng nhập tài khoản'
                ) : (
                  'Đăng ký tài khoản mới'
                )}
              </button>
            </form>

            <div className="relative flex items-center justify-center my-0.5">
              <div className="border-t border-slate-150 dark:border-slate-800 w-full absolute" />
              <span className="bg-white dark:bg-slate-900 px-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest relative">hoặc đăng nhập nhanh</span>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold bg-white dark:bg-slate-950/80 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 text-slate-750 dark:text-slate-250 transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
              Đăng nhập nhanh với Google
            </button>

            {/* Google Unverified Warning Assistant Card */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-[10px] text-amber-800 dark:text-amber-450 rounded-xl space-y-1">
              <p className="font-bold flex items-center gap-1">
                ⚠️ Hướng dẫn vượt qua cảnh báo Google:
              </p>
              <p className="leading-relaxed">
                Do ứng dụng đang ở chế độ thử nghiệm (Development), Google sẽ hiển thị màn hình <strong>"Google chưa xác minh ứng dụng này"</strong>. 
                Hãy bấm vào <strong>"Nâng cao" (Advanced)</strong> ở góc dưới, sau đó bấm tiếp <strong>"Đi tới Clinic Flow (không an toàn)"</strong> để tiếp tục đăng nhập bình thường & an toàn tuyệt đối.
              </p>
            </div>

            <div className="text-center pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
              <p className="text-[9px] text-slate-400">© Clinic Flow Lifestyle Medicine</p>
              <button
                onClick={() => setIsOfflineMode(true)}
                className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer hover:underline"
              >
                Chạy ngoại tuyến (Offline) →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Custom Toast for In-App Notifications */}
      {activeToast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-slate-950 text-white rounded-2xl p-4 shadow-2xl border border-slate-800 flex gap-3 animate-slideIn print:hidden">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-base shrink-0 font-bold animate-bounce">
            🔔
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-100">{activeToast.title}</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">{activeToast.message}</p>
          </div>
          <button 
            onClick={() => setActiveToast(null)} 
            className="text-slate-500 hover:text-white text-xs font-bold ml-auto self-start"
            id="close-toast-btn"
          >
            ✕
          </button>
        </div>
      )}

      {/* PRINT-ONLY CONTAINER: Exquisite Clinical Daily Lifestyle Prescription */}
      <div className="hidden print:block p-10 bg-white text-slate-900 max-w-4xl mx-auto font-sans">
        <div className="border-b-2 border-slate-950 pb-4 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">CLINIC FLOW</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">PHÁC ĐỒ Y HỌC LỐI SỐNG & LỊCH TRÌNH SINH HỌC HẰNG NGÀY</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Ngày lập: <strong>{getFormattedDate()}</strong></p>
            <p>Người thực hiện: <strong>{user ? user.email : 'Người dùng Clinic Flow'}</strong></p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-l-4 border-indigo-600 rounded-r-lg italic text-xs text-slate-700 mb-6 leading-relaxed">
          &ldquo;{dailyQuote}&rdquo;
        </div>

        <div className="mb-6 grid grid-cols-3 gap-4 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Hiệu suất nhiệm vụ</p>
            <p className="text-base font-bold text-slate-900">{tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0}% hoàn thành</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Hoạt động đã xong</p>
            <p className="text-base font-bold text-emerald-600">{tasks.filter(t => t.completed).length} / {tasks.length}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Mức giải lao</p>
            <p className="text-base font-bold text-slate-900">{preferences.breakDuration} phút / mỗi {preferences.breakInterval} phút</p>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xs font-bold uppercase tracking-widest border-b border-slate-200 pb-1.5 text-slate-800">Chi tiết phân bổ thời gian sinh học</h2>
          
          <div className="space-y-3">
            {schedule.map((item, index) => (
              <div key={index} className="flex gap-4 items-start border-b border-slate-100 pb-2">
                <div className="w-24 shrink-0 font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-center">
                  {item.startTime} - {item.endTime}
                </div>
                <div className="flex-grow">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{item.activity}</span>
                    <span className="text-[8px] font-normal text-slate-400 uppercase tracking-widest bg-slate-50 px-1.5 py-0.2 rounded border">
                      {item.type}
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-600 italic mt-0.5">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800 mb-3">Chỉ định lâm sàng & Gợi ý từ Bác sĩ Lối sống</h3>
            <div className="grid grid-cols-2 gap-4">
              {suggestions.slice(0, 4).map((sug, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-900 mb-1">📋 {sug.title}</h4>
                  <p className="text-[9px] text-slate-600 leading-relaxed">{sug.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 flex justify-end">
          <div className="text-center w-48">
            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-8">Chữ ký Bác sĩ Lâm sàng</p>
            <div className="border-b border-slate-300 w-32 mx-auto mb-1"></div>
            <p className="text-[10px] font-bold text-slate-800">Clinic Flow AI Coach</p>
          </div>
        </div>
      </div>

      {/* MAIN SCREEN INTERFACE */}
      <div className="min-h-screen bg-[#F9FAFB] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col md:flex-row antialiased print:hidden w-full">
      {/* LEFT SIDEBAR: Task Management & Preferences */}
      <aside className="w-full md:w-[360px] bg-white dark:bg-slate-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col shrink-0 gap-6 print:hidden">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-indigo-600 dark:bg-indigo-500 rounded-full animate-pulse"></div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">CLINIC FLOW</h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wide uppercase">Tối ưu hóa Lối sống & Sinh học</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-slate-400 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-amber-400 bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-slate-750 rounded-xl transition-all border border-slate-100 dark:border-slate-800"
              title={isDarkMode ? "Chuyển sang Chế độ Sáng" : "Chuyển sang Chế độ Tối"}
              id="toggle-dark-mode-btn"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
            </button>
            {/* Preferences Toggle */}
            <button
              onClick={() => setIsCustomizing(!isCustomizing)}
              className="p-2 text-slate-400 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-slate-750 rounded-xl transition-all border border-slate-100 dark:border-slate-800"
              title="Thay đổi thiết lập lịch trình"
              id="toggle-prefs-btn"
            >
              <Compass className="w-4 h-4" />
            </button>
          </div>
        </div>

        {user && (
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/80 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn">
            <div className="space-y-0.5 min-w-0">
              <p className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Tài khoản kết nối</p>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-350 truncate" title={user.email}>
                {user.email}
              </p>
            </div>
            <button
              onClick={handleGoogleLogout}
              className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/45 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-450 rounded-lg text-[9px] font-bold transition-all cursor-pointer shrink-0 border border-rose-100/30 dark:border-rose-950/30 flex items-center gap-1 hover:scale-105 active:scale-95 animate-pulse"
              id="sidebar-logout-btn"
              title="Đăng xuất tài khoản để khôi phục mặc định"
            >
              <LogOut className="w-3 h-3" />
              Đăng xuất
            </button>
          </div>
        )}

        {isOfflineMode && (
          <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn">
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1">
                ⚠️ Chế độ ngoại tuyến (Offline)
              </p>
              <p className="text-[9px] text-amber-700/80 dark:text-amber-500/80 leading-tight">
                Đăng nhập bằng Gmail để lưu trữ lâu dài và đồng bộ lịch trình sinh học.
              </p>
            </div>
            <button
              onClick={() => setIsOfflineMode(false)}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg text-[9px] font-bold transition-all cursor-pointer shrink-0 shadow-sm"
              id="sidebar-connect-btn"
            >
              Kết nối
            </button>
          </div>
        )}

        {/* Dynamic preference widget or input Form */}
        <div className="space-y-6">
          {isCustomizing ? (
            <div className="relative animate-fadeIn">
              <PreferencesForm preferences={preferences} onChange={handleUpdatePreferences} />
              <button
                onClick={() => setIsCustomizing(false)}
                className="mt-3 w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs transition-all"
                id="close-prefs-btn"
              >
                Thu nhỏ cài đặt
              </button>
            </div>
          ) : (
            <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/40 text-xs text-indigo-950 flex flex-col gap-2">
              <div className="flex justify-between items-center font-bold text-[10px] text-indigo-700 uppercase tracking-widest">
                <span>Thiết lập lịch trình</span>
                <button 
                  onClick={() => setIsCustomizing(true)} 
                  className="text-indigo-600 hover:underline cursor-pointer"
                  id="edit-prefs-link"
                >
                  Thay đổi
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>🌅 Thức dậy: <span className="font-semibold">{preferences.wakeUpTime}</span></div>
                <div>🌙 Đi ngủ: <span className="font-semibold">{preferences.sleepTime}</span></div>
                <div>⏱️ Làm việc: <span className="font-semibold">{preferences.breakInterval}p</span></div>
                <div>☕ Nghỉ giải lao: <span className="font-semibold">{preferences.breakDuration}p</span></div>
              </div>
              <div className="mt-2 pt-2 border-t border-indigo-100 flex items-center gap-1 opacity-90">
                <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                <span>Ưu tiên hiện tại: <span className="font-semibold">{preferences.focusStyle === 'priority' ? 'Độ ưu tiên cao' : preferences.focusStyle === 'deadline' ? 'Sát hạn chót' : 'Năng lượng đầu ngày'}</span></span>
              </div>
            </div>
          )}

          {/* Quick Add Task */}
          <TaskForm onAddTask={handleAddTask} />

          {/* Task Optimization & Management Menu */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3.5 print:hidden">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Menu Tối ưu hoàn thành
              </span>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  if (tasks.length === 0) return;
                  const updated = tasks.map(t => ({ ...t, completed: true }));
                  setTasks(updated);
                  if (preferences.showCompletedInSchedule === false) {
                    handleOptimize(updated, preferences);
                  }
                }}
                disabled={tasks.length === 0 || tasks.every(t => t.completed)}
                className="py-1.5 px-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-40 text-indigo-700 dark:text-indigo-300 font-semibold rounded-lg text-[10px] transition-all cursor-pointer text-center flex items-center justify-center gap-1"
                id="mark-all-completed-btn"
              >
                Xong tất cả
              </button>
              <button
                onClick={() => {
                  if (tasks.length === 0) return;
                  const updated = tasks.map(t => ({ ...t, completed: false }));
                  setTasks(updated);
                  handleOptimize(updated, preferences);
                }}
                disabled={tasks.length === 0 || tasks.every(t => !t.completed)}
                className="py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-[10px] transition-all cursor-pointer text-center flex items-center justify-center gap-1"
                id="mark-all-incomplete-btn"
              >
                Chưa xong tất cả
              </button>
            </div>

            {/* Clear completed button */}
            {tasks.some(t => t.completed) && (
              <button
                onClick={() => {
                  if (confirm('Bạn có chắc chắn muốn xóa các công việc đã hoàn thành khỏi danh sách?')) {
                    const remaining = tasks.filter(t => !t.completed);
                    setTasks(remaining);
                    handleOptimize(remaining, preferences);
                  }
                }}
                className="w-full py-1.5 px-2 bg-rose-50 dark:bg-rose-950/25 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-semibold rounded-lg text-[10px] transition-all cursor-pointer text-center flex items-center justify-center gap-1"
                id="clear-completed-btn"
              >
                <Trash2 className="w-3 h-3" /> Xóa công việc đã xong
              </button>
            )}

            {/* Schedule Completion Display Behavior Toggle */}
            <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Giữ việc đã xong trong lịch trình</span>
                <button
                  onClick={handleToggleShowCompletedInSchedule}
                  className={`w-9 h-5 rounded-full p-0.5 transition-all cursor-pointer relative ${
                    preferences.showCompletedInSchedule !== false ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  id="toggle-schedule-completed-view"
                  title="Bật: Việc đã xong vẫn giữ vị trí trong lịch sinh học. Tắt: Lịch trình tự sắp xếp lại dồn việc chưa xong lên trước."
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all transform ${
                    preferences.showCompletedInSchedule !== false ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-normal">
                {preferences.showCompletedInSchedule !== false 
                  ? '✓ Các việc đã hoàn thành sẽ giữ nguyên vị trí trong lịch sinh học hôm nay.' 
                  : '🕒 Lịch trình tự sắp xếp lại, dồn các việc chưa xong lên trước.'}
              </p>
            </div>
          </div>

          {/* List of current Tasks */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Danh sách nhiệm vụ
              </label>
              {tasks.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách?')) {
                      setTasks([]);
                      handleOptimize([], preferences);
                    }
                  }}
                  className="text-[10px] text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
                  id="clear-all-tasks-btn"
                >
                  Xóa tất cả
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-400 gap-0.5 border border-transparent dark:border-slate-800">
              <button
                onClick={() => setTaskFilter('all')}
                className={`flex-1 py-1 rounded-md transition-all cursor-pointer text-center ${
                  taskFilter === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'hover:text-slate-900 dark:hover:text-slate-100 text-slate-500 dark:text-slate-400'
                }`}
                id="filter-all-btn"
              >
                Tất cả ({tasks.length})
              </button>
              <button
                onClick={() => setTaskFilter('active')}
                className={`flex-1 py-1 rounded-md transition-all cursor-pointer text-center ${
                  taskFilter === 'active' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'hover:text-slate-900 dark:hover:text-slate-100 text-slate-500 dark:text-slate-400'
                }`}
                id="filter-active-btn"
              >
                Chưa xong ({tasks.filter(t => !t.completed).length})
              </button>
              <button
                onClick={() => setTaskFilter('completed')}
                className={`flex-1 py-1 rounded-md transition-all cursor-pointer text-center ${
                  taskFilter === 'completed' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'hover:text-slate-900 dark:hover:text-slate-100 text-slate-500 dark:text-slate-400'
                }`}
                id="filter-completed-btn"
              >
                Đã xong ({tasks.filter(t => t.completed).length})
              </button>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {tasks.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-100 dark:border-slate-800/80 rounded-xl text-slate-400 dark:text-slate-500 text-xs bg-slate-50/50 dark:bg-slate-900/30">
                  Danh sách trống. Hãy thêm nhiệm vụ đầu tiên của bạn ở trên để bắt đầu sắp xếp lịch làm việc!
                </div>
              ) : tasks.filter(t => {
                if (taskFilter === 'active') return !t.completed;
                if (taskFilter === 'completed') return t.completed;
                return true;
              }).length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-100 dark:border-slate-800/80 rounded-xl text-slate-400 dark:text-slate-500 text-xs bg-slate-50/50 dark:bg-slate-900/30">
                  Không tìm thấy nhiệm vụ nào phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                tasks.filter(t => {
                  if (taskFilter === 'active') return !t.completed;
                  if (taskFilter === 'completed') return t.completed;
                  return true;
                }).map(task => (
                  <div
                    key={task.id}
                    id={`task-item-${task.id}`}
                    className={`p-3 rounded-xl border transition-all flex justify-between items-start gap-3 group ${
                      task.completed
                        ? 'bg-slate-50 border-slate-100 opacity-60'
                        : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                          task.completed
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-slate-300 hover:border-indigo-500 bg-white'
                        }`}
                        title={task.completed ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}
                        id={`toggle-task-${task.id}`}
                      >
                        {task.completed && <CheckCircle2 className="w-3 h-3 stroke-[3]" />}
                      </button>
                      <div className="min-w-0">
                        <span className={`text-xs font-semibold text-slate-800 break-words block ${task.completed ? 'line-through text-slate-400' : ''}`}>
                          {task.title}
                        </span>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[9px] text-slate-400 flex items-center gap-0.5 font-medium">
                            <Clock className="w-2.5 h-2.5 text-indigo-500" /> {task.startTime || '08:00'}{task.endTime ? ` - ${task.endTime}` : ''}
                          </span>
                          <span className="text-[9px] text-slate-400 flex items-center gap-0.5 font-medium">
                            <Calendar className="w-2.5 h-2.5 text-teal-500" /> {(task.date || new Date().toISOString().split('T')[0]).split('-').reverse().join('/')}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {task.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        task.priority === 'high' ? 'bg-rose-50 text-rose-600' :
                        task.priority === 'medium' ? 'bg-amber-50 text-amber-600' :
                        'bg-emerald-50 text-emerald-600'
                      }`}>
                        {task.priority.toUpperCase()}
                      </span>
                      <button
                        onClick={() => setEditingTask(task)}
                        className="text-slate-400 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700/85 border border-slate-100 dark:border-slate-800 transition-all cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95"
                        title="Sửa công việc"
                        id={`edit-task-${task.id}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-slate-400 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-450 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700/85 border border-slate-100 dark:border-slate-800 transition-all cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95"
                        title="Xóa công việc"
                        id={`delete-task-${task.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Reminder / Notification Control Widget */}
        <div className="bg-slate-50 dark:bg-slate-800/45 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3 print:hidden">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">Thông báo & Nhắc nhở</span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
              isNotificationsEnabled 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' 
                : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
              {isNotificationsEnabled ? 'Đang bật' : 'Đã tắt'}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Nhận nhạc chuông và cửa sổ nhắc nhở tự động trước 5 phút khi có chuyển đổi hoạt động sinh học.
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleToggleNotifications}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                isNotificationsEnabled
                  ? 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-250 hover:bg-slate-50 dark:hover:bg-slate-800'
                  : 'bg-indigo-600 border-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-100 dark:shadow-none'
              }`}
              id="enable-notification-btn"
            >
              {isNotificationsEnabled ? <BellOff className="w-3.5 h-3.5 text-rose-500" /> : <Bell className="w-3.5 h-3.5 text-white" />}
              {isNotificationsEnabled ? 'Tắt nhắc nhở' : 'Bật nhắc nhở'}
            </button>
            <button
              onClick={() => {
                playChime();
                showLocalNotification('Âm thanh thử nghiệm 🔔', 'Bạn vừa nghe thấy nhạc chuông thông báo sinh học từ Clinic Flow!');
              }}
              className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer transition-all"
              title="Thử chuông báo"
              id="test-chime-btn"
            >
              Thử chuông
            </button>
          </div>
        </div>



        {/* Brand Quote in Sidebar */}
        <div className="mt-auto pt-4 border-t border-slate-100 hidden md:block">
          <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/20 text-center">
            <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-widest block mb-1">Châm ngôn năng suất</span>
            <p className="text-xs text-indigo-900 italic leading-relaxed">
              &ldquo;{dailyQuote}&rdquo;
            </p>
          </div>
        </div>
      </aside>

      {/* MAIN PANEL: The Optimized Schedule Grid */}
      <main className="flex-1 p-6 md:p-8 flex flex-col min-w-0 bg-[#F9FAFB] dark:bg-slate-950 transition-colors">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <h2 className="text-3xl font-light text-slate-400 dark:text-slate-500">
                Lịch trình <span className="text-slate-900 dark:text-white font-bold tracking-tight">Hôm nay</span>
              </h2>
              {isAiGenerated && (
                <span className="px-2 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[9px] font-extrabold uppercase rounded-full flex items-center gap-1 shadow-sm shadow-indigo-100 dark:shadow-none animate-pulse">
                  <Sparkles className="w-2.5 h-2.5" /> AI Optimized
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">{getFormattedDate()}</p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            {user ? (
              <div className="flex gap-1.5 items-center">
                {/* User Info Badge */}
                <span className="hidden lg:inline-block text-[10px] font-bold text-slate-600 dark:text-slate-350 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1.5 rounded-xl">
                  👤 {user.email}
                </span>

                <button
                  onClick={handleExportToGoogleCalendar}
                  disabled={isSyncing}
                  className="relative px-4 py-2 bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-600 active:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  id="export-calendar-btn"
                  title="Đồng bộ lịch trình sinh học sang Google Calendar"
                >
                  {/* Pulsing visual reminder to sync calendar */}
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                  <Calendar className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
                  {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Calendar'}
                </button>

                <button
                  onClick={handleBackupToGoogleDrive}
                  disabled={isDriveSyncing}
                  className="px-4 py-2 bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 active:bg-indigo-800 text-white rounded-xl text-xs font-semibold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  id="backup-drive-btn"
                  title="Sao lưu toàn bộ cơ sở dữ liệu lên thư mục dùng chung Google Drive"
                >
                  <Download className={`w-3.5 h-3.5 ${isDriveSyncing ? 'animate-pulse' : ''}`} />
                  {isDriveSyncing ? 'Đang sao lưu...' : 'Sao lưu Drive'}
                </button>

                <button
                  onClick={handleGoogleLogout}
                  className="px-3 py-2 border border-rose-200 dark:border-rose-900/30 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/50 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95"
                  title={`Đăng xuất khỏi ${user.email}`}
                  id="logout-calendar-btn"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Đăng xuất
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                id="login-calendar-btn"
                title="Đăng nhập tài khoản Google để bảo mật dữ liệu và đồng bộ lịch trình"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-450" />
                Kết nối Gmail
              </button>
            )}

            <button
              onClick={handlePrint}
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Xuất lịch trình dạng bản in hoặc PDF"
              id="print-btn"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> In / Lưu PDF
            </button>
            <button
              onClick={() => handleOptimize(tasks, preferences)}
              disabled={isLoading}
              className="px-4 py-2 bg-slate-950 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 active:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              id="optimize-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> 
              {isLoading ? 'Đang sắp xếp...' : 'Sắp xếp lại'}
            </button>
          </div>
        </header>

        {/* Ask to integrate Google Calendar banner */}
        {showCalendarPrompt && user && (
          <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn print:hidden">
            <div className="flex gap-3 items-start">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-100 font-bold text-lg">
                📅
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">Tích hợp Google Calendar của bạn?</h4>
                <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                  Chào <strong>{user.email}</strong>! Clinic Flow khuyên bạn nên đồng bộ hóa phác đồ và lịch trình sinh học hôm nay sang Google Calendar cá nhân để nhận chuông nhắc nhở và thông báo trên điện thoại.
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleExportToGoogleCalendar}
                disabled={isSyncing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-900/10 transition-all cursor-pointer"
                id="prompt-accept-btn"
              >
                Tích hợp ngay
              </button>
              <button
                onClick={() => {
                  localStorage.setItem(`planner_prompted_calendar_${user.uid}`, 'true');
                  setShowCalendarPrompt(false);
                }}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium transition-all cursor-pointer"
                id="prompt-decline-btn"
              >
                Để sau
              </button>
            </div>
          </div>
        )}

        {/* Sync Status Notifications */}
        {(syncSuccessMessage || syncErrorMessage || driveSuccessMessage || driveErrorMessage) && (
          <div className="mb-6 animate-fadeIn print:hidden space-y-3">
            {syncSuccessMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3 shadow-sm">
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs shrink-0 font-bold">✓</div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-emerald-950">{syncSuccessMessage}</p>
                  <p className="text-xs text-emerald-700">Giờ đây bạn đã có thể theo dõi và nhận thông báo nhắc nhở lịch sinh học của mình trên ứng dụng Google Calendar.</p>
                </div>
              </div>
            )}
            {syncErrorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-rose-950">Đồng bộ thất bại</p>
                  <p className="text-xs text-rose-700">{syncErrorMessage}</p>
                </div>
              </div>
            )}
            {driveSuccessMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3 shadow-sm">
                <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs shrink-0 font-bold">☁</div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-slate-900">{driveSuccessMessage}</p>
                  <p className="text-xs text-slate-600">File backup của bạn đã được xuất lên thư mục chia sẻ Google Drive thành công.</p>
                </div>
              </div>
            )}
            {driveErrorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-rose-950">Sao lưu Drive thất bại</p>
                  <p className="text-xs text-rose-700">{driveErrorMessage}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PERFORMANCE METRICS & PIE CHART */}
        {tasks.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 mb-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 hover:shadow-md transition-all print:hidden">
            <div className="flex-grow space-y-2 text-center sm:text-left">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Tiến độ hoàn thành công việc lâm sàng
              </h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                Hiệu suất thực hiện: <span className="text-indigo-600 dark:text-indigo-400">{tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0}%</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
                {(() => {
                  const completedCount = tasks.filter(t => t.completed).length;
                  const totalCount = tasks.length;
                  const rate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                  if (rate === 100) return "Tuyệt vời! Bạn đã hoàn thành toàn bộ phác đồ và mục tiêu lối sống đề ra hôm nay.";
                  if (rate >= 66) return "Rất tốt! Tiến độ hoàn thành cao giúp bạn duy trì nhịp sinh học khỏe mạnh và giảm áp lực tư duy.";
                  if (rate >= 33) return "Tiến triển đều đặn. Hãy thực hiện từng việc và tuân thủ các mốc nghỉ ngơi khoa học.";
                  return "Khởi động ngày mới bằng cách giải quyết nhiệm vụ đầu tiên để đánh thức sự tập trung.";
                })()}
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 pt-1.5 text-xs text-slate-600 dark:text-slate-455">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>Đã hoàn tất: <strong className="text-slate-900 dark:text-slate-200">{tasks.filter(t => t.completed).length}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                  <span>Chưa hoàn tất: <strong className="text-slate-900 dark:text-slate-200">{tasks.filter(t => !t.completed).length}</strong></span>
                </div>
                <div className="hidden sm:inline text-slate-300 dark:text-slate-700">|</div>
                <div className="text-slate-500 dark:text-slate-400">Tổng số nhiệm vụ: <strong className="text-slate-950 dark:text-slate-100">{tasks.length}</strong></div>
              </div>
            </div>

            <div className="w-28 h-28 flex justify-center items-center shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Đã hoàn tất', value: tasks.filter(t => t.completed).length },
                      { name: 'Chưa hoàn tất', value: tasks.filter(t => !t.completed).length }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={46}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    <Cell key="completed" fill="#10b981" />
                    <Cell key="remaining" fill={isDarkMode ? "#1e293b" : "#e2e8f0"} />
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`${value} nhiệm vụ`]}
                    contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #f1f5f9' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col justify-center items-center">
                <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                  {tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0}%
                </span>
                <span className="text-[7px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Xong</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading overlay & error state indicators */}
        {isLoading && schedule.length === 0 && (
          <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-12 flex flex-col justify-center items-center gap-4 shadow-sm">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-semibold text-slate-700">Đang khởi tạo lịch trình tối ưu bằng AI...</p>
            <p className="text-xs text-slate-400">Hệ thống đang gộp nhóm công việc và tính toán giờ giải lao khoa học.</p>
          </div>
        )}

        {/* Schedule grid columns */}
        {(!isLoading || schedule.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
            
            {/* COLUMN 1: SÁNG (MORNING) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 flex flex-col shadow-sm transition-all hover:shadow-md" id="morning-schedule-panel">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-amber-400 rounded-full shrink-0"></span> 
                Sáng sớm ({morning.filter(i => i.type === 'task').length} việc)
              </h3>
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                {morning.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic py-4">Chưa có hoạt động nào được phân bổ vào buổi sáng.</p>
                ) : (
                  morning.map(item => {
                    const task = item.taskId ? tasks.find(t => t.id === item.taskId) : null;
                    const isCompleted = task ? task.completed : false;
                    return (
                      <ScheduleCard 
                        key={item.id} 
                        item={item} 
                        onToggleTask={handleToggleTask} 
                        isCompleted={isCompleted} 
                        onEditSchedule={setEditingScheduleItem}
                        onDeleteSchedule={handleDeleteScheduleItem}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {/* COLUMN 2: CHIỀU (AFTERNOON) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 flex flex-col shadow-sm transition-all hover:shadow-md" id="afternoon-schedule-panel">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-blue-400 rounded-full shrink-0"></span> 
                Buổi Chiều ({afternoon.filter(i => i.type === 'task').length} việc)
              </h3>
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                {afternoon.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic py-4">Chưa có hoạt động nào được phân bổ vào buổi chiều.</p>
                ) : (
                  afternoon.map(item => {
                    const task = item.taskId ? tasks.find(t => t.id === item.taskId) : null;
                    const isCompleted = task ? task.completed : false;
                    return (
                      <ScheduleCard 
                        key={item.id} 
                        item={item} 
                        onToggleTask={handleToggleTask} 
                        isCompleted={isCompleted} 
                        onEditSchedule={setEditingScheduleItem}
                        onDeleteSchedule={handleDeleteScheduleItem}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {/* COLUMN 3: TỐI (EVENING) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 flex flex-col shadow-sm transition-all hover:shadow-md" id="evening-schedule-panel">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-indigo-900 dark:bg-indigo-400 rounded-full shrink-0"></span> 
                Tối & Đêm ({evening.filter(i => i.type === 'task').length} việc)
              </h3>
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                {evening.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic py-4">Chưa có hoạt động nào được phân bổ vào buổi tối.</p>
                ) : (
                  evening.map(item => {
                    const task = item.taskId ? tasks.find(t => t.id === item.taskId) : null;
                    const isCompleted = task ? task.completed : false;
                    return (
                      <ScheduleCard 
                        key={item.id} 
                        item={item} 
                        onToggleTask={handleToggleTask} 
                        isCompleted={isCompleted} 
                        onEditSchedule={setEditingScheduleItem}
                        onDeleteSchedule={handleDeleteScheduleItem}
                      />
                    );
                  })
                )}
              </div>
            </div>

          </div>
        )}

        {/* BOTTOM OPTIMIZED AI SUGGESTIONS BAR */}
        {suggestions.length > 0 && (
          <footer className="mt-8 print:mt-12">
            <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative overflow-hidden shadow-xl shadow-slate-950/20">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-lg shadow-md shadow-indigo-600/30 shrink-0">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold tracking-wide mb-2 uppercase text-indigo-400 flex items-center gap-2">
                    LỜI KHUYÊN TỐI ƯU HÓA HIỆU SUẤT
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
                    {suggestions.map((sug) => (
                      <div key={sug.id} className="text-xs leading-relaxed" id={`sug-${sug.id}`}>
                        <span className="font-bold text-slate-200 block mb-0.5 flex items-center gap-1.5">
                          {sug.type === 'grouping' ? <Briefcase className="w-3.5 h-3.5 text-teal-400 shrink-0" /> :
                           sug.type === 'priority' ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" /> :
                           sug.type === 'health' ? <Heart className="w-3.5 h-3.5 text-pink-400 shrink-0" /> :
                           <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          {sug.title}
                        </span>
                        <p className="text-slate-400 font-medium">{sug.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-left lg:text-right shrink-0 lg:border-l border-slate-800 lg:pl-6 pt-4 lg:pt-0 w-full lg:w-auto">
                <p className="text-[9px] text-slate-500 uppercase font-extrabold tracking-widest mb-1">Công việc chưa hoàn tất</p>
                <p className="text-3xl font-extrabold text-indigo-400">
                  {tasks.filter(t => !t.completed).length} <span className="text-xs text-slate-400 font-medium">nhiệm vụ</span>
                </p>
              </div>
            </div>
          </footer>
        )}
      </main>
    </div>

    {/* EDIT TASK MODAL */}
    {editingTask && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fadeIn" id="edit-task-modal">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-2xl w-full max-w-lg space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                <Pencil className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Chỉnh sửa Công Việc</h3>
            </div>
            <button
              onClick={() => setEditingTask(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer text-sm font-semibold p-1"
            >
              Đóng
            </button>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            handleUpdateTask(editingTask);
          }} className="space-y-4">
            {/* Task Title */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                Tên công việc <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editingTask.title}
                onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100"
              />
            </div>

            {/* Times (Start & End) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" /> Giờ bắt đầu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={editingTask.startTime}
                  onChange={(e) => setEditingTask({ ...editingTask, startTime: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" /> Giờ kết thúc
                </label>
                <input
                  type="time"
                  value={editingTask.endTime || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, endTime: e.target.value || undefined })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 cursor-pointer"
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" /> Ngày thực hiện <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={editingTask.date}
                onChange={(e) => setEditingTask({ ...editingTask, date: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 cursor-pointer"
              />
            </div>

            {/* Priority and Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-gray-400" /> Độ ưu tiên
                </label>
                <div className="flex gap-1 bg-gray-50 dark:bg-slate-800/55 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
                  {(['low', 'medium', 'high'] as const).map((p) => {
                    const label = p === 'high' ? 'Cao' : p === 'medium' ? 'Vừa' : 'Thấp';
                    const activeClasses = 
                      p === 'high' ? 'bg-rose-500 text-white shadow-sm' :
                      p === 'medium' ? 'bg-amber-500 text-white shadow-sm' :
                      'bg-emerald-500 text-white shadow-sm';
                    
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEditingTask({ ...editingTask, priority: p })}
                        className={`flex-1 py-1 px-1.5 text-xs font-medium rounded-lg transition-all ${
                          editingTask.priority === p ? activeClasses : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-250'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-gray-400" /> Chủ đề / Nhóm
                </label>
                <select
                  value={editingTask.category}
                  onChange={(e) => setEditingTask({ ...editingTask, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 appearance-none cursor-pointer"
                >
                  <option value="Lâm sàng">🩺 Lâm sàng & Bệnh nhân</option>
                  <option value="Công việc">💼 Hành chính / Nghiên cứu</option>
                  <option value="Học tập">📚 Đào tạo liên tục / CME</option>
                  <option value="Sức khỏe">🥗 Y học Lối sống / Tập luyện</option>
                  <option value="Cá nhân">👤 Cá nhân</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-gray-400" /> Ghi chú thêm
              </label>
              <textarea
                rows={2}
                value={editingTask.notes || ''}
                onChange={(e) => setEditingTask({ ...editingTask, notes: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-sm font-semibold transition-all shadow-md cursor-pointer"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* EDIT SCHEDULE ITEM MODAL */}
    {editingScheduleItem && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fadeIn" id="edit-schedule-modal">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-2xl w-full max-w-lg space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Điều Chỉnh Lịch Trình Chi Tiết</h3>
            </div>
            <button
              onClick={() => setEditingScheduleItem(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer text-sm font-semibold p-1"
            >
              Đóng
            </button>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            handleUpdateScheduleItem(editingScheduleItem);
          }} className="space-y-4">
            {/* Activity Name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                Tên hoạt động <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editingScheduleItem.activity}
                onChange={(e) => setEditingScheduleItem({ ...editingScheduleItem, activity: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100"
              />
            </div>

            {/* Time Slot (Start & End Time) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  Giờ bắt đầu
                </label>
                <input
                  type="time"
                  required
                  value={editingScheduleItem.startTime}
                  onChange={(e) => setEditingScheduleItem({ ...editingScheduleItem, startTime: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  Giờ kết thúc
                </label>
                <input
                  type="time"
                  required
                  value={editingScheduleItem.endTime}
                  onChange={(e) => setEditingScheduleItem({ ...editingScheduleItem, endTime: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 cursor-pointer"
                />
              </div>
            </div>

            {/* Duration & Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                  Thời lượng (phút)
                </label>
                <input
                  type="number"
                  required
                  value={editingScheduleItem.duration}
                  onChange={(e) => setEditingScheduleItem({ ...editingScheduleItem, duration: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                  Phân loại
                </label>
                <select
                  value={editingScheduleItem.type}
                  onChange={(e) => setEditingScheduleItem({ ...editingScheduleItem, type: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 appearance-none cursor-pointer"
                >
                  <option value="task">💼 Công việc chính</option>
                  <option value="break">☕ Nghỉ giải lao</option>
                  <option value="meal">🍲 Ăn uống</option>
                  <option value="routine">✨ Thói quen lối sống</option>
                  <option value="buffer">⏱️ Khoảng dự phòng</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                Ghi chú / Hướng dẫn
              </label>
              <textarea
                rows={2}
                value={editingScheduleItem.description || ''}
                onChange={(e) => setEditingScheduleItem({ ...editingScheduleItem, description: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-gray-900 dark:text-slate-100 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingScheduleItem(null)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-sm font-semibold transition-all shadow-md cursor-pointer"
              >
                Xác Nhận Thay Đổi
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  );
}

// Single card list item block for scheduler with rich color states
function ScheduleCard({ 
  item, 
  onToggleTask, 
  isCompleted,
  onEditSchedule,
  onDeleteSchedule
}: { 
  item: ScheduleItem; 
  onToggleTask: (id: string) => void; 
  isCompleted?: boolean;
  onEditSchedule?: (item: ScheduleItem) => void;
  onDeleteSchedule?: (id: string) => void;
  key?: string;
}) {
  // Styles depending on the slot type
  let colorClass = 'border-slate-200 dark:border-slate-800';
  let badgeText = '';
  let badgeColor = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-450';

  if (item.type === 'task' && isCompleted) {
    colorClass = 'border-l-4 border-l-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/10 opacity-75';
    badgeText = '✓ Đã xong';
    badgeColor = 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300';
  } else {
    switch (item.type) {
      case 'task':
        colorClass = 'border-l-4 border-l-indigo-600';
        badgeText = '💼 Công việc';
        badgeColor = 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300';
        break;
      case 'break':
        colorClass = 'border-l-4 border-l-teal-500 bg-teal-50/20 dark:bg-teal-950/10';
        badgeText = '☕ Nghỉ giải lao';
        badgeColor = 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300';
        break;
      case 'meal':
        colorClass = 'border-l-4 border-l-amber-500 bg-amber-50/20 dark:bg-amber-950/10';
        badgeText = '🍲 Ăn uống';
        badgeColor = 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300';
        break;
      case 'routine':
        colorClass = 'border-l-4 border-l-indigo-900 dark:border-l-indigo-400 bg-indigo-50/10 dark:bg-indigo-950/10';
        badgeText = '✨ Thói quen';
        badgeColor = 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-300';
        break;
      case 'buffer':
        colorClass = 'border-l-4 border-l-slate-400 bg-slate-50 dark:bg-slate-850';
        badgeText = '⏱️ Dự phòng';
        badgeColor = 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
        break;
    }
  }

  return (
    <div className={`p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl transition-all hover:shadow-sm group ${colorClass}`} id={`sched-item-${item.id}`}>
      <div className="flex justify-between items-start gap-2 mb-1.5">
        <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1">
          <Clock className="w-3 h-3 text-indigo-500 dark:text-indigo-450" /> {item.timeSlot}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${badgeColor}`}>
            {badgeText}
          </span>
          {onEditSchedule && (
            <button
              onClick={() => onEditSchedule(item)}
              className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700/85 border border-slate-100/50 dark:border-slate-800 transition-all cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95 shadow-xs"
              title="Chỉnh sửa hoạt động"
              id={`edit-sched-btn-${item.id}`}
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {onDeleteSchedule && (
            <button
              onClick={() => onDeleteSchedule(item.id)}
              className="text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-450 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700/85 border border-slate-100/50 dark:border-slate-800 transition-all cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95 shadow-xs"
              title="Xóa hoạt động khỏi lịch"
              id={`delete-sched-btn-${item.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <h4 className={`text-sm font-bold break-words flex items-center gap-1.5 ${isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
        {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
        {item.activity}
      </h4>

      {item.description && (
        <p className={`text-xs font-medium leading-relaxed mt-1 break-words ${isCompleted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400'}`}>
          {item.description}
        </p>
      )}

      {/* Complete task button nested in cards inside scheduler */}
      {item.type === 'task' && item.taskId && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Thời lượng: {item.duration} phút</span>
          <button
            onClick={() => onToggleTask(item.taskId!)}
            className="text-[10px] font-bold hover:underline cursor-pointer flex items-center gap-1 transition-all"
            id={`mark-complete-sched-${item.taskId}`}
          >
            {isCompleted ? (
              <span className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                ✓ Hoàn thành (Hủy)
              </span>
            ) : (
              <span className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">
                Đánh dấu hoàn thành
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
