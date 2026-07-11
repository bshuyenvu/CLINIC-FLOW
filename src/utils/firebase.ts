import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { ScheduleItem } from '../types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Save user's tasks and preferences to Firestore
export async function saveUserData(userId: string, data: { tasks: any[]; preferences: any }) {
  try {
    await setDoc(doc(db, 'users', userId), {
      tasks: data.tasks,
      preferences: data.preferences,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Lỗi khi lưu dữ liệu người dùng vào Firestore:', err);
  }
}

// Retrieve user's tasks and preferences from Firestore
export async function getUserData(userId: string): Promise<{ tasks: any[]; preferences: any } | null> {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        tasks: data.tasks || [],
        preferences: data.preferences || null
      };
    }
  } catch (err) {
    console.error('Lỗi khi tải dữ liệu người dùng từ Firestore:', err);
  }
  return null;
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const loginWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    throw error;
  }
};

export const registerWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    throw error;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export async function exportScheduleToCalendar(
  schedule: ScheduleItem[],
  accessToken: string
): Promise<{ success: boolean; createdCount: number; error?: string }> {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh';
    
    // Helper to format ISO string for today at HH:MM
    const getISOStringForTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hr = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hr}:${min}:00`;
    };

    let createdCount = 0;

    for (const item of schedule) {
      const event = {
        summary: `[Clinic Flow] ${item.activity}`,
        description: item.description || `Hoạt động xếp lịch tự động. Thời lượng: ${item.duration} phút.`,
        start: {
          dateTime: getISOStringForTime(item.startTime),
          timeZone,
        },
        end: {
          dateTime: getISOStringForTime(item.endTime),
          timeZone,
        },
        reminders: {
          useDefault: true
        }
      };

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        console.error('Error creating event:', errData);
        throw new Error(errData.error?.message || 'Failed to create calendar event');
      }

      createdCount++;
    }

    return { success: true, createdCount };
  } catch (error: any) {
    console.error('Failed to export schedule:', error);
    return { success: false, createdCount: 0, error: error.message };
  }
}

export async function exportDatabaseToDrive(
  data: { tasks: any[]; preferences: any; schedule: any[] },
  accessToken: string,
  userEmail: string
): Promise<{ success: boolean; fileId?: string; error?: string }> {
  try {
    const folderId = '1ulzGIP_-_nul_QurZJHl4hFmoH7EALzs';
    const fileName = `clinic_flow_backup_${userEmail.replace(/[@.]/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: [folderId],
    };

    const fileContent = JSON.stringify({
      exportTime: new Date().toISOString(),
      userEmail,
      ...data
    }, null, 2);

    const boundary = 'foo_bar_baz_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      closeDelimiter;

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: body,
      }
    );

    if (!response.ok) {
      const errData = await response.json();
      console.error('Error uploading file to Drive:', errData);
      throw new Error(errData.error?.message || 'Failed to backup database to Google Drive');
    }

    const resData = await response.json();
    return { success: true, fileId: resData.id };
  } catch (error: any) {
    console.error('Failed to export database to Google Drive:', error);
    return { success: false, error: error.message };
  }
}
