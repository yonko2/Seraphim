# Seraphim – Emergency Assistant: Full Project Context

## Overview

Seraphim is a React Native (Expo) mobile app + Python (FastAPI) backend that acts as an **automated emergency assistant**. It has two modes:

- **Victim Mode**: Monitors device sensors + camera, auto-detects emergencies (falls, disasters), generates an objective report filtering out panic, and alerts an operator via Telegram (call + voice message + text).
- **Helper/First Responder Mode**: Uses AI to recognize accident types and provides step-by-step first aid guidance for bystanders during the critical minutes before emergency services arrive.

**Hackathon project. Budget: $0. All free tiers.**

---

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│   React Native App  │  HTTP   │   Python Backend     │
│   (Expo SDK 54)     │────────▶│   (FastAPI)          │
│                     │         │                      │
│ • Sensor monitoring │         │ • Gemini Vision AI   │
│ • Camera capture    │         │ • TTS (gTTS)         │
│ • Fall detection    │         │ • Telegram calls     │
│ • Health data       │         │   (py-tgcalls)       │
│ • Emergency reports │         │ • Report processing  │
└─────────────────────┘         └──────────┬───────────┘
                                           │
                                    ngrok tunnel
                                           │
                                    ┌──────▼──────┐
                                    │  Telegram    │
                                    │  (Operator)  │
                                    └─────────────┘
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Mobile App | React Native (Expo) | SDK 54 |
| Language (App) | TypeScript | 5.x |
| State Management | Zustand | 5.x |
| Navigation | React Navigation | 7.x |
| Camera | expo-camera | 16.x |
| Sensors | expo-sensors | 14.x |
| AI (on-device) | Google Gemini API | gemini-2.0-flash-lite |
| Backend | FastAPI (Python) | 0.115.x |
| TTS | gTTS (Google Translate TTS) | Free |
| Telegram Client | Telethon + py-tgcalls | 2.2.11 |
| Audio Conversion | FFmpeg | 8.1 |
| Tunneling | ngrok | Free tier |

---

## Project Structure

```
Seraphim/
├── app/                          # React Native (Expo) frontend
│   ├── App.tsx                   # Root component with navigation
│   ├── app.json                  # Expo config
│   ├── package.json              # Dependencies
│   └── src/
│       ├── types/index.ts        # Core TypeScript types
│       ├── store/useStore.ts     # Zustand global state
│       ├── utils/constants.ts    # App constants
│       ├── navigation/           # React Navigation setup
│       │   ├── AppNavigator.tsx  # Stack navigator
│       │   ├── MainTabs.tsx      # Bottom tab navigator
│       │   └── types.ts         # Navigation types
│       ├── screens/
│       │   ├── HomeScreen.tsx          # Mode selection (Victim/Helper)
│       │   ├── VictimDashboard.tsx     # Main victim monitoring screen
│       │   ├── HelperDashboard.tsx     # First aid guidance screen
│       │   ├── EmergencyScreen.tsx     # Active emergency display
│       │   └── SettingsScreen.tsx      # Configuration
│       ├── components/
│       │   ├── SensorMonitor.tsx       # Live sensor data display
│       │   ├── CameraView.tsx          # Camera with AI classification
│       │   ├── HealthMetrics.tsx       # Health data display
│       │   ├── EmergencyReport.tsx     # Emergency report card
│       │   ├── FirstAidGuide.tsx       # Step-by-step first aid
│       │   ├── ErrorBoundary.tsx       # React error boundary
│       │   └── PermissionGate.tsx      # Permission request wrapper
│       ├── services/
│       │   ├── ai/
│       │   │   ├── GeminiService.ts    # Gemini API client (classify, report, first aid)
│       │   │   ├── DisasterDetector.ts # Combines camera + sensors for detection
│       │   │   └── PanicFilter.ts      # Filters emotional content from reports
│       │   ├── sensors/
│       │   │   ├── SensorManager.ts    # Accelerometer, gyroscope management
│       │   │   ├── FallDetector.ts     # Fall detection algorithm
│       │   │   └── types.ts            # Sensor types
│       │   ├── health/
│       │   │   ├── HealthProvider.ts        # Health data interface
│       │   │   ├── AppleHealthProvider.ts   # Apple HealthKit (mock)
│       │   │   └── GoogleHealthProvider.ts  # Google Health Connect (mock)
│       │   ├── emergency/
│       │   │   ├── ReportGenerator.ts  # Generates structured emergency reports
│       │   │   └── EmergencyManager.ts # Orchestrates detection → report → alert
│       │   └── api/
│       │       └── BackendClient.ts    # HTTP client to FastAPI backend
│       └── hooks/
│           ├── useSensors.ts               # Sensor data hook
│           ├── useHealthData.ts            # Health data hook
│           └── useEmergencyDetection.ts    # Main detection orchestration hook
│
├── backend/                      # Python FastAPI backend
│   ├── main.py                   # FastAPI app, endpoints, lifespan
│   ├── requirements.txt          # Python dependencies
│   ├── .env                      # Telegram credentials (gitignored)
│   ├── .env.example              # Template for .env
│   ├── audio/                    # Generated TTS audio files
│   ├── seraphim_session.session  # Telethon session file
│   └── services/
│       ├── telegram_caller.py    # Telegram call + voice message + text alert
│       ├── tts_service.py        # gTTS text-to-speech generation
│       └── report_processor.py   # Formats emergency data into readable text
│
├── businessreq.md                # Original business requirements
├── prompt.md                     # THIS FILE — full project context
├── README.md                     # User-facing documentation
└── .gitignore                    # Node + Python + IDE ignores
```

---

## What's Done (Working)

### Frontend (React Native)
- [x] Full Expo TypeScript project scaffolded and compiles clean
- [x] Navigation: Home → Victim Dashboard / Helper Dashboard, Emergency Screen, Settings
- [x] **Victim Dashboard**: live accelerometer/gyroscope display, camera feed with Gemini AI classification, health metrics panel, emergency trigger button
- [x] **Helper Dashboard**: accident type recognition + step-by-step first aid guidance from Gemini
- [x] **Fall Detection**: algorithm using accelerometer magnitude thresholds
- [x] **Camera AI**: captures photo → sends to backend `/api/analyze` → Gemini classifies disaster type + severity
- [x] **Panic Filter**: strips emotional/panicked language from reports, produces objective data
- [x] **Report Generator**: creates structured emergency reports from all available data
- [x] **Backend Client**: sends reports to FastAPI backend via HTTP
- [x] Zustand state management with hardcoded config
- [x] Error boundary + permission gates
- [x] Runs on iPhone via Expo Go (tunnel mode)

### Backend (Python)
- [x] FastAPI with CORS, health check, emergency, test-call, status endpoints
- [x] **Telegram Calling** (py-tgcalls v2.2.11): rings the operator's phone via Telegram
- [x] **Voice Messages**: gTTS generates MP3 → sent as Telegram voice note (guaranteed delivery)
- [x] **Text Alerts**: formatted emergency text sent alongside voice message
- [x] Audio conversion: MP3 → OGG Opus via FFmpeg for VoIP compatibility
- [x] Report processor formats sensor/health/emergency data into natural language
- [x] Lifespan management (connect on start, disconnect on shutdown)

### Emergency Alert Flow (Working)
```
Emergency Detected → Report Generated → Sent to Backend
→ Backend generates TTS audio
→ Rings operator via Telegram call (attention-grabber)
→ Sends voice message with full report (reliable delivery)
→ Sends text alert summary
```

---

## What Needs Improvement

### High Priority (For Hackathon Demo)
1. **Gemini API Key Quota**: The current key may have exhausted its free quota. If camera classification stops working, generate a new API key from Google AI Studio (https://aistudio.google.com/apikey) and update it in `app/src/store/useStore.ts` line 13.

2. **ngrok URL Changes Every Restart**: The free ngrok tier gives a new URL each time. After restarting ngrok, update the URL in `app/src/store/useStore.ts` line 11 (`backendUrl`). Consider adding a Settings screen field so it can be changed at runtime.

3. **VoIP Audio Inconsistency**: The Telegram call rings reliably, but VoIP audio streaming (hearing the TTS through the call) works intermittently due to Telegram's private call NAT/WebRTC negotiation. The voice message is the reliable fallback — this is by design.

4. **Health Data is Mocked**: AppleHealthProvider and GoogleHealthProvider are mock implementations returning simulated data. For a real demo, integrate with actual HealthKit/Health Connect APIs or pair with a real wearable.

### Medium Priority (Post-Hackathon)
5. **Real Wearable Integration**: The health provider architecture is extensible — add real providers for Apple Watch, Fitbit, Garmin, blood glucose monitors via their SDKs/APIs.

6. **Automatic Emergency Detection**: Currently the emergency button is manual. Wire `useEmergencyDetection` hook to auto-trigger when fall detection + camera classification both indicate an emergency, with a countdown/cancel UI.

7. **112 Integration**: Replace Telegram with actual emergency number dialing. Telegram is a hackathon workaround — production would use a proper VoIP gateway or native phone call API.

8. **Multi-Language TTS**: gTTS supports many languages. The report processor could detect the user's locale and generate audio in their language.

9. **Backend Deployment**: Currently runs locally with ngrok. Deploy to a free tier (Railway, Render, Fly.io) for persistent hosting.

10. **Offline Mode**: Cache last-known health data and sensor readings. Queue emergency reports when offline, send when reconnected.

### Low Priority (Nice to Have)
11. **Push Notifications**: Alert the helper/first responder via push when an emergency is detected nearby (would need user location + proximity matching).

12. **Call History/Logs**: Store past emergencies in a database with timestamps, reports, and outcomes.

13. **Two-Way Communication**: After the automated report, enable the operator to communicate back (currently one-way).

14. **Battery Optimization**: Continuous sensor monitoring drains battery. Implement adaptive monitoring (reduce frequency when stationary).

---

## How to Run

### Prerequisites
- Node.js 18+
- Python 3.12+
- FFmpeg (installed and on PATH)
- Expo Go app on your phone
- ngrok account (free)

### Backend
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Create .env with your Telegram credentials:
# TELEGRAM_API_ID=your_api_id
# TELEGRAM_API_HASH=your_api_hash
# TELEGRAM_PHONE=+your_phone
# OPERATOR_TELEGRAM_ID=username_or_id

python main.py
# Runs on http://localhost:8000
```

### ngrok Tunnel
```powershell
npx ngrok http 8000
# Copy the https://xxx.ngrok-free.dev URL
# Update app/src/store/useStore.ts backendUrl with it
```

### Frontend
```powershell
cd app
npm install
npx expo start --tunnel
# Scan QR code with Expo Go on your phone
```

---

## Configuration (Hardcoded in useStore.ts)

| Setting | Current Value | Location |
|---------|--------------|----------|
| Backend URL | `https://dreamful-amiya-mostly.ngrok-free.dev` | `app/src/store/useStore.ts:11` |
| Operator Telegram ID | `Bayryamcho` | `app/src/store/useStore.ts:12` |
| Detection Sensitivity | `0.7` | `app/src/store/useStore.ts:13` |
| Gemini Model | `gemini-2.0-flash-lite` | `backend/services/gemini_service.py:24` |

### Backend .env
| Variable | Purpose |
|----------|---------|
| `TELEGRAM_API_ID` | Telegram API app ID |
| `TELEGRAM_API_HASH` | Telegram API app hash |
| `TELEGRAM_PHONE` | Phone number for Telegram auth |
| `OPERATOR_TELEGRAM_ID` | Who receives emergency alerts |
| `GEMINI_API_KEY` | Google Gemini API key for image analysis |

---

## Key Technical Decisions & Lessons Learned

1. **Expo SDK 54 (not 55)**: SDK 55 was canary and incompatible with Expo Go. Downgraded for stability.

2. **Gemini 2.0-flash-lite**: `gemini-1.5-flash` was deprecated, `gemini-2.0-flash` hit quota instantly. Flash-lite has higher free limits.

3. **Telegram over Twilio**: Zero budget requirement. Telegram calling is free (Telethon + py-tgcalls), Twilio costs money after trial credits.

4. **py-tgcalls v2.2.11**: Upgraded from v2.1.0 — fixed status enum compatibility and improved VoIP reliability for private calls.

5. **OGG Opus conversion**: Raw MP3 from gTTS didn't stream well over Telegram VoIP. Converting to OGG Opus (Telegram's native codec) via FFmpeg improved audio delivery.

6. **Voice message as primary delivery**: Telegram VoIP audio is unreliable for private calls (NAT issues). The call rings for attention, the voice message reliably delivers the report. Don't change this.

7. **Hermes engine quirks**: React Native's Hermes JS engine doesn't have `DOMException`. Fixed AbortController error handling to check `error.name === 'AbortError'` instead.

8. **useRef for mutable state in callbacks**: Camera's `isAnalyzing` flag was stale in `useCallback` closures. Switched to `useRef` to avoid stale captures.

9. **No uvicorn --reload**: File watcher crashed the backend when Telethon session files changed. Disabled auto-reload.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check, returns Telegram + Gemini status |
| POST | `/emergency` | Receives emergency report, triggers call + voice msg + text |
| POST | `/api/analyze` | Analyzes image with Gemini Vision AI, returns emergency classification |
| POST | `/api/first-aid` | Generates context-specific first aid guidance via Gemini AI |
| POST | `/api/filter-panic` | Rewrites panicked text into calm, objective observations via Gemini AI |
| POST | `/test-call` | Makes a test call to the operator |
| GET | `/status/{call_id}` | Returns status of a specific call |

### POST /emergency — Request Body
```json
{
  "timestamp": 1711612800.0,
  "emergency_type": "fall",
  "severity": "high",
  "location": { "latitude": 42.6977, "longitude": 23.3219 },
  "sensor_data": [{ "type": "accelerometer", "values": {} }],
  "health_data": { "heartRate": 120, "bloodOxygen": 94 },
  "objective_description": "Person detected fallen, high impact registered",
  "recommended_actions": ["Check breathing", "Call 112"],
  "raw_observations": ["Sudden acceleration spike detected"]
}
```

---

## Dependencies

### Frontend (package.json)
- expo, react-native, typescript
- @react-navigation/native, @react-navigation/bottom-tabs, @react-navigation/native-stack
- expo-camera, expo-sensors, expo-location
- zustand (state)
- @expo/vector-icons

### Backend (requirements.txt)
- fastapi, uvicorn
- telethon (Telegram MTProto client)
- py-tgcalls (Telegram VoIP calls)
- gTTS (Google Translate TTS)
- google-generativeai (Gemini Vision AI)
- python-dotenv
- pydantic      