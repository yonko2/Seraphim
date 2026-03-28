"""FastAPI router for Garmin Connect integration."""

from datetime import date
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from services.garmin_service import garmin_service

router = APIRouter(prefix="/garmin", tags=["garmin"])


class GarminAuthRequest(BaseModel):
    email: str
    password: str


class GarminAuthResponse(BaseModel):
    success: bool
    message: str
    profile: Optional[dict] = None


class GarminHealthDataResponse(BaseModel):
    heartRate: Optional[int] = None
    bloodOxygen: Optional[float] = None
    stepCount: Optional[int] = None
    lastUpdated: int
    source: str = "garmin"
    date: str
    bodyBattery: Optional[int] = None
    stressLevel: Optional[int] = None
    sleepScore: Optional[int] = None


class GarminStatusResponse(BaseModel):
    available: bool
    authenticated: bool
    email: Optional[str] = None


@router.get("/status", response_model=GarminStatusResponse)
async def get_status():
    """Check Garmin service availability and authentication status."""
    return GarminStatusResponse(
        available=garmin_service.is_available(),
        authenticated=garmin_service.is_authenticated(),
        email=garmin_service._email if garmin_service.is_authenticated() else None,
    )


@router.post("/auth", response_model=GarminAuthResponse)
async def authenticate(request: GarminAuthRequest):
    """Authenticate with Garmin Connect using email and password.
    
    Tokens are stored securely for future sessions.
    """
    if not garmin_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="Garmin Connect service not available. Check if garminconnect package is installed."
        )

    success = await garmin_service.authenticate(request.email, request.password)
    
    if not success:
        raise HTTPException(
            status_code=401,
            detail="Authentication failed. Please check your credentials."
        )

    # Fetch user profile after successful auth
    try:
        profile = await garmin_service.get_user_profile()
    except Exception:
        profile = None

    return GarminAuthResponse(
        success=True,
        message="Successfully authenticated with Garmin Connect",
        profile=profile,
    )


@router.post("/auth/token", response_model=GarminAuthResponse)
async def authenticate_with_tokens():
    """Try to authenticate using stored tokens (no password required)."""
    if not garmin_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="Garmin Connect service not available."
        )

    success = await garmin_service.authenticate_with_tokens()
    
    if not success:
        raise HTTPException(
            status_code=401,
            detail="No valid tokens found. Please authenticate with email/password first."
        )

    try:
        profile = await garmin_service.get_user_profile()
    except Exception:
        profile = None

    return GarminAuthResponse(
        success=True,
        message="Successfully authenticated with stored tokens",
        profile=profile,
    )


@router.post("/disconnect", response_model=GarminAuthResponse)
async def disconnect():
    """Logout and disconnect from Garmin Connect."""
    await garmin_service.disconnect()
    return GarminAuthResponse(
        success=True,
        message="Successfully disconnected from Garmin Connect",
    )


@router.get("/health-data", response_model=GarminHealthDataResponse)
async def get_health_data(target_date: Optional[str] = None):
    """Get health data from Garmin Connect for a specific date.
    
    Args:
        target_date: Date in YYYY-MM-DD format (defaults to today)
    """
    if not garmin_service.is_authenticated():
        raise HTTPException(
            status_code=401,
            detail="Not authenticated with Garmin Connect. Please authenticate first."
        )

    try:
        if target_date:
            parsed_date = date.fromisoformat(target_date)
        else:
            parsed_date = date.today()

        data = await garmin_service.get_health_data(parsed_date)
        return GarminHealthDataResponse(**data)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch health data: {str(e)}")
