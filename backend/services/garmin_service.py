"""Garmin Connect service for fetching health data from Garmin watches."""

import logging
from datetime import date
from pathlib import Path
from typing import Optional, Any

from garminconnect import Garmin, GarminConnectAuthenticationError

logger = logging.getLogger("seraphim.garmin")

TOKENSTORE = str(Path.home() / ".garminconnect")


class GarminService:
    """Wraps python-garminconnect for auth and health data fetching."""

    def __init__(self):
        self._client: Optional[Garmin] = None
        self._authenticated = False

    @property
    def is_authenticated(self) -> bool:
        return self._authenticated and self._client is not None

    def login(self, email: str, password: str) -> dict:
        """Authenticate with Garmin Connect. Stores tokens for persistence."""
        try:
            self._client = Garmin(email=email, password=password)
            self._client.login(tokenstore=TOKENSTORE)
            self._client.garth.dump(TOKENSTORE)
            self._authenticated = True
            logger.info(f"Garmin login successful for {email}")
            return {
                "success": True,
                "display_name": self._client.display_name,
                "full_name": self._client.full_name,
            }
        except GarminConnectAuthenticationError as e:
            logger.error(f"Garmin auth failed: {e}")
            self._authenticated = False
            raise
        except Exception as e:
            logger.error(f"Garmin login error: {e}")
            self._authenticated = False
            raise

    def try_restore_session(self) -> bool:
        """Try to restore a previous session from stored tokens."""
        try:
            tokenstore_path = Path(TOKENSTORE)
            if not tokenstore_path.exists():
                return False
            self._client = Garmin()
            self._client.login(tokenstore=TOKENSTORE)
            self._authenticated = True
            logger.info("Garmin session restored from tokens")
            return True
        except Exception as e:
            logger.debug(f"Could not restore Garmin session: {e}")
            self._authenticated = False
            self._client = None
            return False

    def logout(self):
        """Clear stored tokens and disconnect."""
        import shutil
        tokenstore_path = Path(TOKENSTORE)
        if tokenstore_path.exists():
            shutil.rmtree(tokenstore_path, ignore_errors=True)
        self._client = None
        self._authenticated = False
        logger.info("Garmin session cleared")

    def _ensure_auth(self):
        if not self.is_authenticated:
            raise RuntimeError("Not authenticated with Garmin Connect")

    def get_heart_rate(self, day: Optional[str] = None) -> dict:
        """Get heart rate data for a given day (default: today)."""
        self._ensure_auth()
        day = day or date.today().isoformat()
        try:
            return self._client.get_heart_rates(day)
        except Exception as e:
            logger.error(f"Failed to get heart rate: {e}")
            raise

    def get_stress(self, day: Optional[str] = None) -> dict:
        """Get stress data for a given day."""
        self._ensure_auth()
        day = day or date.today().isoformat()
        try:
            return self._client.get_stress_data(day)
        except Exception as e:
            logger.error(f"Failed to get stress: {e}")
            raise

    def get_spo2(self, day: Optional[str] = None) -> dict:
        """Get SpO2 (blood oxygen) data for a given day."""
        self._ensure_auth()
        day = day or date.today().isoformat()
        try:
            return self._client.get_spo2_data(day)
        except Exception as e:
            logger.error(f"Failed to get SpO2: {e}")
            raise

    def get_body_battery(self, day: Optional[str] = None) -> list:
        """Get body battery data for a given day."""
        self._ensure_auth()
        day = day or date.today().isoformat()
        try:
            return self._client.get_body_battery(day)
        except Exception as e:
            logger.error(f"Failed to get body battery: {e}")
            raise

    def get_hrv(self, day: Optional[str] = None) -> dict:
        """Get HRV (heart rate variability) data for a given day."""
        self._ensure_auth()
        day = day or date.today().isoformat()
        try:
            return self._client.get_hrv_data(day)
        except Exception as e:
            logger.error(f"Failed to get HRV: {e}")
            raise

    def get_daily_summary(self, day: Optional[str] = None) -> dict:
        """Get full daily summary (steps, calories, etc)."""
        self._ensure_auth()
        day = day or date.today().isoformat()
        try:
            return self._client.get_stats(day)
        except Exception as e:
            logger.error(f"Failed to get daily summary: {e}")
            raise

    def get_devices(self) -> list:
        """Get list of connected Garmin devices."""
        self._ensure_auth()
        try:
            return self._client.get_devices()
        except Exception as e:
            logger.error(f"Failed to get devices: {e}")
            raise

    def get_health_snapshot(self) -> dict:
        """Get a combined health snapshot with latest available data."""
        self._ensure_auth()
        today = date.today().isoformat()
        snapshot = {}

        # Heart rate
        try:
            hr_data = self._client.get_heart_rates(today)
            if hr_data:
                snapshot["heart_rate"] = {
                    "resting": hr_data.get("restingHeartRate"),
                    "max": hr_data.get("maxHeartRate"),
                    "min": hr_data.get("minHeartRate"),
                    "current": self._extract_latest_hr(hr_data),
                }
        except Exception as e:
            logger.warning(f"HR fetch failed: {e}")
            snapshot["heart_rate"] = None

        # Stress
        try:
            stress_data = self._client.get_stress_data(today)
            if stress_data:
                snapshot["stress"] = {
                    "overall": stress_data.get("overallStressLevel"),
                    "rest": stress_data.get("restStressDuration"),
                    "high": stress_data.get("highStressDuration"),
                }
        except Exception as e:
            logger.warning(f"Stress fetch failed: {e}")
            snapshot["stress"] = None

        # SpO2
        try:
            spo2_data = self._client.get_spo2_data(today)
            if spo2_data:
                snapshot["spo2"] = {
                    "average": spo2_data.get("averageSPO2"),
                    "lowest": spo2_data.get("lowestSPO2"),
                    "latest": spo2_data.get("latestSPO2"),
                }
        except Exception as e:
            logger.warning(f"SpO2 fetch failed: {e}")
            snapshot["spo2"] = None

        # Body Battery
        try:
            bb_data = self._client.get_body_battery(today)
            if bb_data and isinstance(bb_data, list) and len(bb_data) > 0:
                latest = bb_data[-1] if bb_data else {}
                snapshot["body_battery"] = {
                    "current": latest.get("bodyBatteryLevel"),
                    "charged": latest.get("bodyBatteryChargedValue"),
                    "drained": latest.get("bodyBatteryDrainedValue"),
                }
            else:
                snapshot["body_battery"] = None
        except Exception as e:
            logger.warning(f"Body battery fetch failed: {e}")
            snapshot["body_battery"] = None

        # HRV
        try:
            hrv_data = self._client.get_hrv_data(today)
            if hrv_data:
                summary = hrv_data.get("hrvSummary", {})
                snapshot["hrv"] = {
                    "weekly_avg": summary.get("weeklyAvg"),
                    "last_night": summary.get("lastNight"),
                    "status": summary.get("status"),
                }
        except Exception as e:
            logger.warning(f"HRV fetch failed: {e}")
            snapshot["hrv"] = None

        return snapshot

    def _extract_latest_hr(self, hr_data: dict) -> Optional[int]:
        """Extract the most recent heart rate reading from HR data."""
        entries = hr_data.get("heartRateValues", [])
        if not entries:
            return None
        # Entries are [timestamp_ms, hr_value] pairs; find latest non-null
        for ts, hr in reversed(entries):
            if hr is not None and hr > 0:
                return hr
        return None


# Singleton
_garmin_service: Optional[GarminService] = None


def get_garmin_service() -> GarminService:
    global _garmin_service
    if _garmin_service is None:
        _garmin_service = GarminService()
        _garmin_service.try_restore_session()
    return _garmin_service
