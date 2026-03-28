import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from services.telegram_caller import TelegramCaller
from services.tts_service import TTSService
from services.report_processor import ReportProcessor


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


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "telegram_connected": telegram_caller is not None and telegram_caller.is_connected,
    }


@app.post("/emergency", response_model=CallStatus)
async def handle_emergency(report: EmergencyReportRequest):
    """Receive emergency report, generate TTS audio, and initiate Telegram voice call."""
    if not telegram_caller or not telegram_caller.is_connected:
        raise HTTPException(status_code=503, detail="Telegram client not connected")

    try:
        report_text = report_processor.format_report(report.model_dump())
        audio_path = await tts_service.generate_audio(report_text)
        operator_id = int(os.getenv("OPERATOR_TELEGRAM_ID", "0"))
        call_id = await telegram_caller.make_call(operator_id, audio_path)

        return CallStatus(
            status="call_initiated",
            call_id=call_id,
            message=f"Emergency call initiated to operator",
        )
    except Exception as e:
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
            "This is a test call from Seraphim Emergency Assistant. "
            "If you receive this call, the system is working correctly. "
            "No emergency is occurring."
        )
        audio_path = await tts_service.generate_audio(test_text)
        operator_id = int(os.getenv("OPERATOR_TELEGRAM_ID", "0"))
        call_id = await telegram_caller.make_call(operator_id, audio_path)

        return CallStatus(
            status="test_call_initiated",
            call_id=call_id,
            message="Test call initiated",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to make test call: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
