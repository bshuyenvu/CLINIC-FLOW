import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithCredential } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { ScheduleItem } from '../types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

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
    
    const clientId = firebaseConfig.oAuthClientId || '478860569518-kn1ugdqjedl9f9vmj94podev7o9r5rea.apps.googleusercontent.com';
    const redirectUri = window.location.origin;
    const scopes = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file';
    
    // Construct Google OAuth URL
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scopes)}`;
    
    // Open OAuth Popup
    const popup = window.open(authUrl, 'google_oauth', 'width=600,height=600');
    if (!popup) {
      throw new Error('Popup bị chặn. Vui lòng cho phép hiển thị popup trên trình duyệt để tiếp tục liên kết Google.');
    }
    
    const token = await new Promise<string>((resolve, reject) => {
      // Create message event listener to receive token instantly
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'GOOGLE_OAUTH_SUCCESS' && event.data?.accessToken) {
          window.removeEventListener('message', handleMessage);
          resolve(event.data.accessToken);
        }
      };
      window.addEventListener('message', handleMessage);
      
      const interval = setInterval(() => {
        try {
          if (!popup || popup.closed) {
            clearInterval(interval);
            window.removeEventListener('message', handleMessage);
            reject(new Error('Người dùng đã hủy hoặc đóng cửa sổ liên kết Google.'));
            return;
          }
          
          if (popup.location.origin === window.location.origin) {
            const hash = popup.location.hash;
            if (hash && hash.includes('access_token=')) {
              const params = new URLSearchParams(hash.substring(1));
              const accessToken = params.get('access_token');
              clearInterval(interval);
              window.removeEventListener('message', handleMessage);
              popup.close();
              if (accessToken) {
                resolve(accessToken);
              } else {
                reject(new Error('Không tìm thấy Access Token từ phản hồi của Google.'));
              }
            }
          }
        } catch (e) {
          // Cross-origin access error is normal while user is on accounts.google.com
        }
      }, 500);
    });
    
    cachedAccessToken = token;
    
    // Sign into Firebase Auth using the credential from Google to sync Firestore
    const credential = GoogleAuthProvider.credential(null, token);
    const result = await signInWithCredential(auth, credential);
    
    return { user: result.user, accessToken: token };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
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
    // Dynamically look for or create a folder named "Clinic Flow Backup" in the user's personal Google Drive
    let folderId = 'root';
    try {
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='Clinic Flow Backup' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.files && searchData.files.length > 0) {
          folderId = searchData.files[0].id;
        } else {
          // Create the folder if it does not exist
          const createResponse = await fetch(
            'https://www.googleapis.com/drive/v3/files',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: 'Clinic Flow Backup',
                mimeType: 'application/vnd.google-apps.folder',
              }),
            }
          );
          if (createResponse.ok) {
            const createData = await createResponse.json();
            folderId = createData.id;
          }
        }
      }
    } catch (folderError) {
      console.error('Lỗi khi tìm hoặc tạo thư mục sao lưu, sẽ lưu ở thư mục gốc:', folderError);
    }

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
