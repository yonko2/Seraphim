# 🛡️ Seraphim — Emergency Assistant

> AI-powered emergency detection and response app built for hackathon

## Overview

Seraphim is a two-mode mobile app (**Victim** and **Helper**) that detects emergencies through device sensors and AI camera analysis, generates objective reports free of panic or emotion, and automatically alerts operators via Telegram voice messages.

When a victim's phone detects a fall or the camera recognizes a disaster, Seraphim builds a structured emergency report — including GPS location and health vitals — converts it to speech, and sends it directly to an operator on Telegram.

## Features

- 🚨 **Automatic Emergency Detection** — Fall detection via accelerometer, disaster recognition via camera + Gemini AI
- 📊 **Smart Reporting** — AI-filtered objective reports (removes panic/emotion from raw data)
- 📞 **Telegram Alerts** — Automated voice messages and text alerts to emergency operators
- ❤️ **Health Integration** — Apple HealthKit & Google Health Connect support (heart rate, blood oxygen, blood glucose)
- 🎯 **Helper Mode** — AI-powered first-aid guidance for bystanders
- 📷 **Camera AI** — Real-time disaster classification (fire, flood, crash, medical emergency, violence)
- 🗣️ **Text-to-Speech** — Emergency reports narrated via Google TTS for voice delivery

## Tech Stack

| Layer | Technology |
|---|---|
| **Mobile App** | React Native 0.83 · Expo 55 · TypeScript |
| **Navigation** | React Navigation (native stack + bottom tabs) |
| **State** | Zustand |
| **AI / Vision** | Google Gemini (`@google/generative-ai`) |
| **Sensors** | expo-sensors (accelerometer), expo-camera, expo-location |
| **Backend** | Python 3.10+ · FastAPI · Uvicorn |
| **Telegram** | Telethon · py-tgcalls |
| **TTS** | gTTS (Google Translate TTS) |

## Architecture

```
┌─────────────────────────────────────────────┐
│              Mobile App (Expo)               │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Sensors  │  │ Camera + │  │  Health    │  │
│  │ (Fall    │  │ Gemini   │  │  (Apple /  │  │
│  │ Detect)  │  │ AI       │  │  Google)   │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│       │              │              │         │
│       └──────┬───────┴──────────────┘         │
│              ▼                                │
│     ┌─────────────────┐                       │
│     │ Panic Filter +  │                       │
│     │ Report Generator│                       │
│     └────────┬────────┘                       │
└──────────────┼────────────────────────────────┘
               │  POST /emergency
               ▼
┌──────────────────────────────────────────────┐
│           Backend (FastAPI)                   │
│                                              │
│  ┌────────────────┐  ┌───────────────────┐   │
│  │ Report         │  │ TTS Service       │   │
│  │ Processor      │──│ (gTTS → MP3)      │   │
│  └────────────────┘  └────────┬──────────┘   │
│                               │              │
│                    ┌──────────▼──────────┐   │
│                    │ Telegram Caller     │   │
│                    │ (Telethon)          │   │
│                    └──────────┬──────────┘   │
└───────────────────────────────┼──────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Operator (Telegram)  │
                    │  🔊 Voice message     │
                    │  📝 Text alert        │
                    └───────────────────────┘
```

## Project Structure

```
Seraphim/
├── app/                          # React Native / Expo mobile app
│   ├── src/
│   │   ├── components/
│   │   │   ├── CameraView.tsx        # Camera preview + AI trigger
│   │   │   ├── EmergencyReport.tsx   # Report display UI
│   │   │   ├── FirstAidGuide.tsx     # Helper mode first-aid steps
│   │   │   ├── HealthMetrics.tsx     # Vitals display
│   │   │   └── SensorMonitor.tsx     # Real-time sensor readout
│   │   ├── hooks/
│   │   │   ├── useEmergencyDetection.ts
│   │   │   ├── useHealthData.ts
│   │   │   └── useSensors.ts
│   │   ├── navigation/
│   │   │   ├── AppNavigator.tsx
│   │   │   └── MainTabs.tsx
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx        # Mode selection (Victim / Helper)
│   │   │   ├── VictimDashboard.tsx   # Sensor monitoring + alerts
│   │   │   ├── HelperDashboard.tsx   # First-aid guidance
│   │   │   ├── EmergencyScreen.tsx   # Active emergency view
│   │   │   └── SettingsScreen.tsx    # API keys, backend URL
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   │   ├── GeminiService.ts      # Gemini API wrapper
│   │   │   │   ├── DisasterDetector.ts   # Camera frame classification
│   │   │   │   └── PanicFilter.ts        # Strips emotion from reports
│   │   │   ├── sensors/
│   │   │   │   ├── FallDetector.ts       # Accelerometer-based fall detection
│   │   │   │   └── SensorManager.ts      # Sensor lifecycle management
│   │   │   ├── emergency/
│   │   │   │   ├── EmergencyManager.ts   # Orchestrates detection → report → send
│   │   │   │   └── ReportGenerator.ts    # Builds structured report JSON
│   │   │   ├── health/
│   │   │   │   ├── HealthProvider.ts      # Abstract health interface
│   │   │   │   ├── AppleHealthProvider.ts # HealthKit integration
│   │   │   │   └── GoogleHealthProvider.ts# Health Connect integration
│   │   │   └── api/
│   │   │       └── BackendClient.ts      # HTTP client for FastAPI backend
│   │   ├── store/
│   │   │   └── useStore.ts               # Zustand global state
│   │   └── types/
│   ├── App.tsx
│   └── package.json
├── backend/                      # Python FastAPI server
│   ├── main.py                       # FastAPI app + endpoints
│   ├── services/
│   │   ├── report_processor.py       # Formats report for TTS narration
│   │   ├── tts_service.py            # gTTS text-to-speech
│   │   └── telegram_caller.py        # Telethon voice messages + alerts
│   ├── audio/                        # Generated TTS audio files
│   ├── .env.example                  # Environment variable template
│   └── requirements.txt
├── LICENSE                       # MIT License
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **Expo** account ([free signup](https://expo.dev))
- **Gemini API key** — free from [Google AI Studio](https://aistudio.google.com/apikey)
- **Telegram API credentials** — from [my.telegram.org](https://my.telegram.org)

### Mobile App Setup

```bash
cd app/
npm install
npx expo start --dev-client
# or build for a specific platform:
# npx expo run:android
# npx expo run:ios
```

Configure your **Gemini API key** in the app's Settings screen after launch.

### Backend Setup

```bash
cd backend/

# Create & activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and fill in:
#   TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE,
#   OPERATOR_TELEGRAM_ID

# Run the server
python main.py
```

The server starts at `http://0.0.0.0:8000` with auto-reload enabled.

## Usage

### Victim Mode

1. Open Seraphim and choose **Victim**.
2. The app begins monitoring the accelerometer for falls and (optionally) the camera for disaster scenes.
3. When an emergency is detected, the app:
   - Collects GPS location and available health data.
   - Runs observations through the **Panic Filter** to keep the report objective.
   - Sends the structured report to the backend.
4. The backend converts the report to speech and delivers a voice message + text alert to the Telegram operator.

### Helper Mode

1. Open Seraphim and choose **Helper**.
2. The app provides AI-powered first-aid guidance: point your camera at the scene and receive step-by-step instructions for how to assist.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check — returns server status and Telegram connection state |
| `POST` | `/emergency` | Submit an emergency report; triggers TTS generation and Telegram alert |
| `GET` | `/status/{call_id}` | Check the status of a previously initiated emergency call |
| `POST` | `/test-call` | Send a test voice message to the operator to verify the pipeline |

Interactive API docs are available at `/docs` (Swagger UI) when the backend is running.

## Environment Variables

| Variable | Description |
|---|---|
| `TELEGRAM_API_ID` | Telegram API ID from [my.telegram.org](https://my.telegram.org) |
| `TELEGRAM_API_HASH` | Telegram API hash |
| `TELEGRAM_PHONE` | Phone number associated with the Telegram account |
| `OPERATOR_TELEGRAM_ID` | Telegram user ID of the operator who receives alerts |
| `HOST` | Server bind address (default `0.0.0.0`) |
| `PORT` | Server port (default `8000`) |

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.