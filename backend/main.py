import os
import asyncio
import logging
import traceback
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seraphim")

load_dotenv()

from services.telegram_caller import TelegramCaller
from services.tts_service import TTSService
from services.report_processor import ReportProcessor
from services.gemini_service import get_gemini_service


class EmergencyReportRequest(BaseModel):
    timestamp: float
    emergency_type: str
    severity: str
    location: Optional[dict] = None
    sensor_data: Optional[list] = None
    health_data: Optional[dict] = None
    objective_description: str
    recommended_actions: list[str] = []
    raw_observations: list[str] = []


class CallStatus(BaseModel):
    status: str
    call_id: Optional[str] = None
    message: str


class ImageAnalyzeRequest(BaseModel):
    image: str  # base64 encoded image


class VideoAnalyzeRequest(BaseModel):
    frames: list[str]  # list of base64 encoded frames


class ImageAnalyzeResponse(BaseModel):
    emergency: bool
    type: str
    severity: str
    confidence: float
    title: str
    description: str
    icon: str
    instructions: list[str] = []


class FirstAidRequest(BaseModel):
    emergency_type: str
    description: str


class FirstAidResponse(BaseModel):
    steps: list[str]
    emergency_type: str


class PanicFilterRequest(BaseModel):
    text: str


class PanicFilterResponse(BaseModel):
    filtered_text: str


telegram_caller: Optional[TelegramCaller] = None
tts_service = TTSService()
report_processor = ReportProcessor()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global telegram_caller
    try:
        telegram_caller = TelegramCaller(
            api_id=int(os.getenv("TELEGRAM_API_ID", "0")),
            api_hash=os.getenv("TELEGRAM_API_HASH", ""),
            phone=os.getenv("TELEGRAM_PHONE", ""),
        )
        await telegram_caller.connect()
        print("Telegram client connected")
    except Exception as e:
        print(f"Warning: Telegram client not connected: {e}")
        telegram_caller = None
    yield
    if telegram_caller:
        await telegram_caller.disconnect()


app = FastAPI(
    title="Seraphim Emergency Backend",
    description="Backend for Seraphim emergency assistant - handles Telegram voice calls",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).parent / "static"


@app.get("/", response_class=HTMLResponse)
async def demo_page():
    """Serve the emergency detection demo UI."""
    html_path = STATIC_DIR / "index.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@app.get("/health")
async def health_check():
    gemini_service = get_gemini_service()
    return {
        "status": "ok",
        "telegram_connected": telegram_caller is not None and telegram_caller.is_connected,
        "gemini_available": gemini_service.is_available(),
    }


@app.get("/api/health")
async def api_health():
    """Health check for the demo UI."""
    gemini_service = get_gemini_service()
    return {
        "gemini_available": gemini_service.is_available(),
        "provider": gemini_service.provider or "none",
    }


@app.post("/api/analyze", response_model=ImageAnalyzeResponse)
async def analyze_image(request: ImageAnalyzeRequest):
    """Analyze an image for emergency situations using Gemini Vision AI."""
    gemini_service = get_gemini_service()

    if not gemini_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="Gemini AI not available. Check GEMINI_API_KEY in .env"
        )

    try:
        # Strip data URL prefix if present (e.g., "data:image/jpeg;base64,")
        image_data = request.image
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        result = await gemini_service.analyze_image(image_data)

        return ImageAnalyzeResponse(**result)

    except ValueError as e:
        logger.error(f"Image analysis failed - invalid response: {e}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")
    except RuntimeError as e:
        logger.error(f"Image analysis failed - runtime error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")
    except Exception as e:
        logger.error(f"Image analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze image: {str(e)}")


@app.post("/api/analyze-video", response_model=ImageAnalyzeResponse)
async def analyze_video(request: VideoAnalyzeRequest):
    """Analyze multiple video frames for emergency situations."""
    gemini_service = get_gemini_service()

    if not gemini_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="AI service not available. Check API keys in .env"
        )

    if not request.frames:
        raise HTTPException(status_code=400, detail="No frames provided")

    logger.info(f"Video analysis: received {len(request.frames)} frames")

    try:
        # Strip data URL prefixes and limit to 5 frames (Groq max)
        cleaned_frames = []
        for frame in request.frames:
            if "," in frame:
                frame = frame.split(",", 1)[1]
            cleaned_frames.append(frame)

        result = await gemini_service.analyze_video_frames(cleaned_frames)
        return ImageAnalyzeResponse(**result)

    except ValueError as e:
        logger.error(f"Video analysis failed - invalid response: {e}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")
    except Exception as e:
        logger.error(f"Video analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze video: {str(e)}")


@app.post("/api/first-aid", response_model=FirstAidResponse)
async def get_first_aid(request: FirstAidRequest):
    """Generate context-specific first aid guidance using Gemini AI."""
    gemini_service = get_gemini_service()

    if not gemini_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="Gemini AI not available. Check GEMINI_API_KEY in .env"
        )

    try:
        steps = await gemini_service.get_first_aid_guidance(
            request.emergency_type,
            request.description
        )
        return FirstAidResponse(
            steps=steps,
            emergency_type=request.emergency_type
        )
    except Exception as e:
        logger.error(f"First aid guidance failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate guidance: {str(e)}")


@app.post("/api/filter-panic", response_model=PanicFilterResponse)
async def filter_panic(request: PanicFilterRequest):
    """Rewrite panicked text into calm, objective observations using Gemini AI."""
    gemini_service = get_gemini_service()

    if not gemini_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="Gemini AI not available. Check GEMINI_API_KEY in .env"
        )

    try:
        filtered = await gemini_service.filter_panic(request.text)
        return PanicFilterResponse(filtered_text=filtered)
    except Exception as e:
        logger.error(f"Panic filter failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to filter text: {str(e)}")


@app.post("/emergency", response_model=CallStatus)
async def handle_emergency(report: EmergencyReportRequest):
    """Receive emergency report, generate TTS audio, and initiate Telegram voice call."""
    if not telegram_caller or not telegram_caller.is_connected:
        raise HTTPException(status_code=503, detail="Telegram client not connected")

    try:
        report_text = report_processor.format_report(report.model_dump())
        audio_path = await tts_service.generate_audio(report_text)
        operator_id_raw = os.getenv("OPERATOR_TELEGRAM_ID", "0")
        operator_id = int(operator_id_raw) if operator_id_raw.isdigit() else operator_id_raw
        call_id = await telegram_caller.make_call(operator_id, audio_path)

        return CallStatus(
            status="call_initiated",
            call_id=call_id,
            message=f"Emergency call initiated to operator",
        )
    except Exception as e:
        logger.error(f"Emergency handler failed: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to handle emergency: {str(e)}")


@app.get("/status/{call_id}", response_model=CallStatus)
async def get_call_status(call_id: str):
    """Get the status of an ongoing emergency call."""
    if not telegram_caller:
        raise HTTPException(status_code=503, detail="Telegram client not connected")

    status = await telegram_caller.get_call_status(call_id)
    return CallStatus(
        status=status.get("state", "unknown"),
        call_id=call_id,
        message=status.get("message", ""),
    )


@app.post("/test-call", response_model=CallStatus)
async def test_call():
    """Make a test call to the operator with a sample message."""
    if not telegram_caller or not telegram_caller.is_connected:
        raise HTTPException(status_code=503, detail="Telegram client not connected")

    try:
        test_text = (
            "Hello, this is a test call. I want to check whether you can hear me clearly and respond naturally. Please tell me the current status of my request, then ask me one follow-up question. My name is Alex, and I’m calling about an appointment on Tuesday at 3:30 PM. If you understood that, repeat the day and time back to me. Also, please confirm whether you can handle rescheduling, cancellations, and general questions. Thank you."
        )
        audio_path = await tts_service.generate_audio(test_text)
        operator_id_raw = os.getenv("OPERATOR_TELEGRAM_ID", "0")
        operator_id = int(operator_id_raw) if operator_id_raw.isdigit() else operator_id_raw
        call_id = await telegram_caller.make_call(operator_id, audio_path)

        return CallStatus(
            status="test_call_initiated",
            call_id=call_id,
            message="Test call initiated",
        )
    except Exception as e:
        logger.error(f"Test call failed: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to make test call: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=False,
    )
