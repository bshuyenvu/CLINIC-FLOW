import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { localScheduler } from "./src/utils/scheduler.js";
import { Task, UserPreferences } from "./src/types.js";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = 3000;

// Enable JSON body parsing (essential for POST requests)
app.use(express.json());

// Initialize Gemini Client safely
const apiKey = process.env.GEMINI_API_KEY;
const isKeyConfigured = apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim() !== "";

let ai: GoogleGenAI | null = null;
if (isKeyConfigured) {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini AI client successfully initialized server-side.");
  } catch (err) {
    console.error("Failed to initialize Gemini AI client:", err);
  }
} else {
  console.log("No valid GEMINI_API_KEY found. Application will use the local smart scheduling engine.");
}

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", aiEnabled: !!ai });
});

// Endpoint to optimize task schedule using AI or fallback local scheduler
app.post("/api/optimize-schedule", async (req, res) => {
  const { tasks, preferences } = req.body as { tasks: Task[]; preferences: UserPreferences };

  if (!tasks || !Array.isArray(tasks)) {
    res.status(400).json({ error: "Invalid task list provided" });
    return;
  }

  if (!preferences) {
    res.status(400).json({ error: "Preferences are required" });
    return;
  }

  // If there are no tasks, return an empty schedule immediately
  if (tasks.length === 0) {
    res.json({
      schedule: [],
      suggestions: [
        {
          id: "sug_empty",
          title: "Chưa có công việc",
          content: "Hãy thêm ít nhất một công việc để bắt đầu tối ưu và sắp xếp lịch trình làm việc nhé!",
          type: "efficiency"
        }
      ],
      dailyQuote: "Cách tốt nhất để dự đoán tương lai là tự mình kiến tạo nên nó.",
      isAiGenerated: false
    });
    return;
  }

  // Try using AI if client is initialized
  if (ai) {
    try {
      console.log(`Optimizing ${tasks.length} tasks via Gemini AI...`);
      
      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          schedule: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                timeSlot: { type: Type.STRING, description: "Khoảng thời gian thực hiện, ví dụ '08:00 - 09:30'" },
                startTime: { type: Type.STRING, description: "Giờ bắt đầu dạng 'HH:MM'" },
                endTime: { type: Type.STRING, description: "Giờ kết thúc dạng 'HH:MM'" },
                activity: { type: Type.STRING, description: "Tên hoạt động hoặc tên công việc" },
                type: { type: Type.STRING, description: "Phân loại hoạt động: 'task' (công việc trong danh sách), 'break' (nghỉ giải lao ngắn), 'meal' (bữa ăn chính), 'buffer' (thời gian chuyển tiếp/dự phòng), hoặc 'routine' (thói quen chuẩn bị sáng/tối)" },
                taskId: { type: Type.STRING, description: "Mã ID của công việc tương ứng trong danh sách đầu vào, hoặc null nếu đây là hoạt động ăn uống, nghỉ ngơi, thói quen." },
                duration: { type: Type.INTEGER, description: "Thời lượng hoạt động tính bằng phút" },
                description: { type: Type.STRING, description: "Lời khuyên thực hiện chi tiết hoặc nội dung công việc cần làm một cách cụ thể." }
              },
              required: ["id", "timeSlot", "startTime", "endTime", "activity", "type", "taskId", "duration", "description"]
            }
          },
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING, description: "Tiêu đề của gợi ý tối ưu" },
                content: { type: Type.STRING, description: "Mô tả chi tiết lời khuyên (gộp nhóm công việc cùng loại, thứ tự ưu tiên, bảo vệ sức khỏe hoặc tối ưu năng suất)" },
                type: { type: Type.STRING, description: "Phân loại gợi ý: 'grouping' (gộp nhóm việc), 'priority' (ưu tiên việc quan trọng), 'health' (sức khỏe/nghỉ ngơi), 'efficiency' (nâng cao hiệu suất)" }
              },
              required: ["id", "title", "content", "type"]
            }
          },
          dailyQuote: {
            type: Type.STRING,
            description: "Một câu nói truyền cảm hứng sáng tạo, kỷ luật hoặc quản lý thời gian bằng tiếng Việt"
          }
        },
        required: ["schedule", "suggestions", "dailyQuote"]
      };

      const prompt = `
Hãy đóng vai trò là một Bác sĩ Lâm sàng & Chuyên gia Y học Lối sống (Clinical Lifestyle Medicine Specialist).
Nhiệm vụ của bạn là lập lịch trình chi tiết trong ngày từ thời điểm thức dậy (${preferences.wakeUpTime}) đến lúc đi ngủ (${preferences.sleepTime}) dựa trên danh sách các công việc sau đây. 
Hãy tối ưu hóa dưới góc nhìn y khoa và nhịp sinh học (circadian rhythm), nhằm cân bằng tối đa giữa hiệu suất công việc và sức khỏe thể chất/tâm thần của người dùng.

DANH SÁCH CÔNG VIỆC:
${JSONS(preferences.showCompletedInSchedule !== false ? tasks : tasks.filter(t => !t.completed))}

SỞ THÍCH & THIẾT LẬP CỦA NGƯỜI DÙNG:
- Thời gian thức dậy: ${preferences.wakeUpTime}
- Thời gian đi ngủ: ${preferences.sleepTime}
- Tần suất nghỉ giải lao: cứ sau khoảng ${preferences.breakInterval} phút làm việc thì nghỉ ngơi ${preferences.breakDuration} phút.
- Phong cách ưu tiên tập trung (focusStyle): ${preferences.focusStyle} (trong đó: 'priority' nghĩa là ưu tiên việc quan trọng trước; 'deadline' nghĩa là việc sát hạn chót trước; 'energy' nghĩa là ưu tiên việc nặng/phức tạp vào buổi sáng khi hormone cortisol đạt đỉnh giúp tập trung cao nhất).

YÊU CẦU LẬP LỊCH CHUẨN Y KHOA:
1. Phân bổ công việc vào các khung giờ cụ thể sáng - chiều - tối một cách khoa học:
   - Đầu buổi sáng (sau thức dậy): Nên có 15-30 phút đầu tiên tiếp xúc ánh sáng mặt trời tự nhiên để kích hoạt chu kỳ thức-ngủ, hỗ trợ sản sinh cortisol tự nhiên.
   - Tránh làm việc cường độ cực cao ngay khi vừa mở mắt hoặc sát giờ ngủ.
   - Sắp xếp giờ ăn trưa (khoảng 12:00 - 13:00) và ăn tối (khoảng 18:30 - 19:30) cố định như một hoạt động y tế bắt buộc (type: 'meal') để duy trì lượng đường huyết ổn định và bảo vệ hệ tiêu hóa.
   - Sát giờ đi ngủ (${preferences.sleepTime}): Thêm khoảng 30-45 phút "Thời gian đệm thư giãn / Vệ sinh giấc ngủ (Sleep Hygiene)" để ngắt thiết bị điện tử, hạn chế ánh sáng xanh, kích hoạt sản sinh melatonin nội sinh giúp ngủ sâu giấc.

2. Xen kẽ các mốc nghỉ giải lao ngắn (type: 'break') với thời lượng ${preferences.breakDuration} phút một cách khoa học sau mỗi khoảng ${preferences.breakInterval} phút làm việc.
   - Gợi ý trong mô tả giải lao các bài tập nhỏ: Quy tắc 20-20-20 bảo vệ mắt (nhìn xa 20 feet trong 20 giây sau mỗi 20 phút), bài tập giãn cơ cổ vai gáy (stretching), hít thở sâu cơ hoành để giảm căng thẳng, hoặc uống nước bổ sung điện giải.

3. Sắp xếp công việc logic:
   - Các công việc cùng chủ đề ('category') nên xếp gần nhau (Batching) để tránh hội chứng "mệt mỏi chuyển đổi nhận thức" (cognitive switching fatigue).
   - Đặt những công việc nặng nhọc, cần tư duy sâu vào các khung giờ vàng sinh học (thường là 8h30-11h30 sáng và 14h30-17h00 chiều).
   - Công việc nhẹ nhàng hoặc mang tính vận động nhẹ xếp vào lúc sau bữa ăn hoặc cuối chiều khi cơ thể có xu hướng uể oải nhẹ (postprandial somnolence).

4. Phải gán chính xác 'taskId' của hoạt động trùng khớp với ID của công việc trong danh sách được gửi lên. Nếu công việc có thuộc tính completed: true, hãy vẫn sắp xếp và giữ nó trong lịch trình bình thường để ghi nhận hoàn thành.
5. Tạo ít nhất 3-4 gợi ý tối ưu chi tiết (suggestions) bằng tiếng Việt dưới góc nhìn của một BÁC SĨ LÂM SÀNG giải thích lý do khoa học tại sao sắp xếp như vậy (ví dụ: lý do gộp nhóm, tầm quan trọng của việc thư giãn mắt, kiểm soát cortisol, vệ sinh giấc ngủ).
6. Cung cấp một câu nói truyền cảm hứng y học/sức khỏe tinh thần hoặc quản lý năng lượng (dailyQuote) tràn đầy năng lượng bằng tiếng Việt.
7. Đảm bảo tổng thời gian của lịch trình từ thức dậy đến đi ngủ phải khớp hoàn toàn và logic. ID của hoạt động tự sinh ngắn gọn.

Hãy trả về kết quả định dạng JSON chuẩn đúng với Schema yêu cầu.
`;

      const result = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.2, // Low temperature for consistent scheduling structure
        }
      });

      const responseText = result.text;
      if (responseText) {
        const parsed = JSON.parse(responseText.trim());
        res.json({
          ...parsed,
          isAiGenerated: true
        });
        return;
      }
    } catch (apiError) {
      console.error("Gemini AI API Call failed, falling back to local scheduling engine:", apiError);
    }
  }

  // Local fallback execution
  console.log("Using Local Scheduling Engine to construct daily plan...");
  const localResult = localScheduler(tasks, preferences);
  res.json({
    ...localResult,
    isAiGenerated: false
  });
});

// Helper function to safely stringify objects for prompt injection
function JSONS(obj: any): string {
  return JSON.stringify(obj, null, 2);
}

// Vite Server Configuration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Production static files server configured.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Application dev server running on http://localhost:${PORT}`);
  });
}

startServer();
