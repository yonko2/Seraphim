"""Garmin Connect service wrapper for fetching health data."""

import os
import logging
from datetime import date
from typing import Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger("seraphim")

# Lazy import garminconnect to avoid import errors if not installed
try:
    from garminconnect import Garmin
    GARMIN_AVAILABLE = True
except ImportError:
    GARMIN_AVAILABLE = False
    logger.warning("garminconnect package not installed. Garmin features will be unavailable.")


class GarminService:
    """Service for interacting with Garmin Connect API."""

    def __init__(self):
        self.client: Optional[Any] = None
        self.token_dir = Path.home() / ".garminconnect"
        self._email: Optional[str] = None
        self._password: Optional[str] = None

    def is_available(self) -> bool:
        """Check if the garminconnect package is installed."""
        return GARMIN_AVAILABLE

    def is_authenticated(self) -> bool:
        """Check if we have an authenticated client."""
        return self.client is not None

    async def authenticate(self, email: str, password: str) -> bool:
        """Authenticate with Garmin Connect using email/password.
        
        Tokens are automatically stored in ~/.garminconnect for future use.
        """
        if not GARMIN_AVAILABLE:
            logger.error("garminconnect package not installed")
            return False

        try:
            self.client = Garmin(email, password)
            self.client.login()
            self._email = email
            self._password = password
            logger.info(f"Successfully authenticated Garmin user: {email}")
            return True
        except Exception as e:
            logger.error(f"Garmin authentication failed: {e}")
            self.client = None
            return False

    async def authenticate_with_tokens(self) -> bool:
        """Try to authenticate using stored tokens (no password needed)."""
        if not GARMIN_AVAILABLE:
            return False

        try:
            # Garmin client automatically loads tokens from ~/.garminconnect
            self.client = Garmin()
            self.client.login()
            logger.info("Successfully authenticated with stored Garmin tokens")
            return True
        except Exception as e:
            logger.warning(f"Failed to authenticate with stored tokens: {e}")
            self.client = None
            return False

    async def disconnect(self) -> bool:
        """Logout and clear the client."""
        if self.client:
            try:
                self.client.logout()
            except Exception as e:
                logger.warning(f"Error during Garmin logout: {e}")
            self.client = None
            self._email = None
            self._password = None
        return True

    async def get_health_data(self, target_date: Optional[date] = None) -> Dict[str, Any]:
        """Fetch health data for a specific date (defaults to today)."""
        if not self.client:
            raise RuntimeError("Not authenticated with Garmin")

        if target_date is None:
            target_date = date.today()

        date_str = target_date.strftime('%Y-%m-%d')
        
        try:
            # Get various health metrics
            stats = self.client.get_stats(date_str)
            hr_data = self.client.get_heart_rates(date_str)
            
            # Extract relevant metrics
            health_data = {
                "heartRate": hr_data.get("restingHeartRate"),
                "bloodOxygen": stats.get("averageSpO2"),
                "stepCount": stats.get("totalSteps"),
                "lastUpdated": int(target_date.timestamp() * 1000),
                "source": "garmin",
                "date": date_str,
            }

            # Add optional metrics if available
            if "bodyBattery" in stats:
                health_data["bodyBattery"] = stats["bodyBattery"]
            if "stressLevel" in stats:
                health_data["stressLevel"] = stats["stressLevel"]
            if "sleepScore" in stats:
                health_data["sleepScore"] = stats["sleepScore"]

            return health_data

        except Exception as e:
            logger.error(f"Failed to fetch Garmin health data: {e}")
            raise RuntimeError(f"Failed to fetch health data: {str(e)}")

    async def get_user_profile(self) -> Dict[str, Any]:
        """Get basic user profile information."""
        if not self.client:
            raise RuntimeError("Not authenticated with Garmin")

        try:
            profile = self.client.get_user_summary()
            return {
                "displayName": profile.get("displayName"),
                "fullName": profile.get("fullName"),
                "profileImage": profile.get("profileImageUrl"),
            }
        except Exception as e:
            logger.error(f"Failed to fetch Garmin profile: {e}")
            raise RuntimeError(f"Failed to fetch profile: {str(e)}")


# Singleton instance
garmin_service = GarminService()
