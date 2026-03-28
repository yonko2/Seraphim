"""Collapse detection engine combining phone accelerometer + gyroscope + health data."""

import logging
import time
from typing import Optional
from dataclasses import dataclass, field

logger = logging.getLogger("seraphim.collapse")

# Thresholds
FREEFALL_G = 0.3          # Below this = freefall (normal is ~1.0g)
IMPACT_G = 3.0            # Above this = significant impact
SEVERE_IMPACT_G = 5.0     # Above this = severe impact
HR_CRITICAL_LOW = 40      # Dangerously low HR
HR_CRITICAL_HIGH = 170    # Dangerously high sustained HR
HR_SPIKE_THRESHOLD = 150  # Sudden spike
SPO2_CRITICAL = 85        # Dangerously low blood oxygen
STRESS_CRITICAL = 80      # Very high stress score
GYRO_TUMBLE_THRESHOLD = 5.0   # rad/s — rapid rotation (tumbling)
GYRO_SEVERE_THRESHOLD = 8.0   # rad/s — very rapid rotation

# Collapse confidence weights
WEIGHT_IMPACT = 0.30
WEIGHT_GYRO = 0.15
WEIGHT_HR = 0.25
WEIGHT_SPO2 = 0.10
WEIGHT_PATTERN = 0.20


@dataclass
class AccelReading:
    x: float
    y: float
    z: float
    timestamp: float

    @property
    def magnitude(self) -> float:
        return (self.x ** 2 + self.y ** 2 + self.z ** 2) ** 0.5


@dataclass
class GyroReading:
    x: float
    y: float
    z: float
    timestamp: float

    @property
    def magnitude(self) -> float:
        return (self.x ** 2 + self.y ** 2 + self.z ** 2) ** 0.5


@dataclass
class CollapseAssessment:
    collapsed: bool
    confidence: float
    reason: str
    health_data: Optional[dict] = None
    details: dict = field(default_factory=dict)


class CollapseDetector:
    """Heuristic collapse detection combining accelerometer + gyroscope + health signals."""

    def __init__(self):
        self._recent_readings: list[AccelReading] = []
        self._last_collapse_time: float = 0
        self._cooldown_seconds = 60

    def assess(
        self,
        accel_data: list[dict],
        garmin_health: Optional[dict] = None,
        gyro_data: Optional[list[dict]] = None,
    ) -> CollapseAssessment:
        """
        Assess collapse probability from accelerometer + gyroscope + health data.

        accel_data: list of {x, y, z, timestamp} from phone accelerometer
        gyro_data: list of {x, y, z, timestamp} from phone gyroscope
        garmin_health: health snapshot (real or simulated)
        """
        readings = [
            AccelReading(
                x=d.get("x", 0), y=d.get("y", 0), z=d.get("z", 0),
                timestamp=d.get("timestamp", time.time()),
            )
            for d in accel_data
        ]

        gyro_readings = []
        if gyro_data:
            gyro_readings = [
                GyroReading(
                    x=d.get("x", 0), y=d.get("y", 0), z=d.get("z", 0),
                    timestamp=d.get("timestamp", time.time()),
                )
                for d in gyro_data
            ]

        if not readings:
            return CollapseAssessment(
                collapsed=False, confidence=0.0,
                reason="No accelerometer data", health_data=garmin_health,
            )

        self._recent_readings.extend(readings)
        cutoff = time.time() - 60
        self._recent_readings = [r for r in self._recent_readings if r.timestamp > cutoff]

        # Score components
        impact_score = self._score_impact(readings)
        gyro_score = self._score_gyro(gyro_readings)
        hr_score = self._score_heart_rate(garmin_health)
        spo2_score = self._score_spo2(garmin_health)
        pattern_score = self._score_pattern(readings, gyro_readings)

        total = (
            impact_score * WEIGHT_IMPACT +
            gyro_score * WEIGHT_GYRO +
            hr_score * WEIGHT_HR +
            spo2_score * WEIGHT_SPO2 +
            pattern_score * WEIGHT_PATTERN
        )

        reasons = []
        if impact_score > 0.5:
            reasons.append("significant impact detected")
        if gyro_score > 0.5:
            reasons.append("rapid body rotation (tumble)")
        if hr_score > 0.5:
            reasons.append("abnormal heart rate")
        if spo2_score > 0.5:
            reasons.append("low blood oxygen")
        if pattern_score > 0.5:
            reasons.append("freefall-to-impact pattern")

        collapsed = total >= 0.55 and len(reasons) >= 1

        now = time.time()
        if collapsed and (now - self._last_collapse_time) < self._cooldown_seconds:
            return CollapseAssessment(
                collapsed=False, confidence=total,
                reason="Collapse detected but in cooldown period",
                health_data=garmin_health,
                details={
                    "impact": impact_score, "gyro": gyro_score,
                    "hr": hr_score, "spo2": spo2_score, "pattern": pattern_score,
                },
            )

        if collapsed:
            self._last_collapse_time = now

        reason = "; ".join(reasons) if reasons else "No anomalies detected"

        return CollapseAssessment(
            collapsed=collapsed,
            confidence=round(total, 3),
            reason=f"{'COLLAPSE: ' if collapsed else ''}{reason}",
            health_data=garmin_health,
            details={
                "impact": round(impact_score, 3),
                "gyro": round(gyro_score, 3),
                "hr": round(hr_score, 3),
                "spo2": round(spo2_score, 3),
                "pattern": round(pattern_score, 3),
            },
        )

    def _score_impact(self, readings: list[AccelReading]) -> float:
        """Score based on acceleration magnitude spikes."""
        if not readings:
            return 0.0
        magnitudes = [r.magnitude for r in readings]
        peak = max(magnitudes)
        if peak >= SEVERE_IMPACT_G:
            return 1.0
        if peak >= IMPACT_G:
            return 0.6 + 0.4 * ((peak - IMPACT_G) / (SEVERE_IMPACT_G - IMPACT_G))
        return 0.0

    def _score_gyro(self, readings: list[GyroReading]) -> float:
        """Score based on gyroscope angular velocity (rotation during fall)."""
        if not readings:
            return 0.0
        magnitudes = [r.magnitude for r in readings]
        peak = max(magnitudes)
        if peak >= GYRO_SEVERE_THRESHOLD:
            return 1.0
        if peak >= GYRO_TUMBLE_THRESHOLD:
            return 0.5 + 0.5 * ((peak - GYRO_TUMBLE_THRESHOLD) / (GYRO_SEVERE_THRESHOLD - GYRO_TUMBLE_THRESHOLD))
        return 0.0

    def _score_heart_rate(self, health: Optional[dict]) -> float:
        """Score based on heart rate anomalies."""
        if not health or not health.get("heart_rate"):
            return 0.0
        hr_data = health["heart_rate"]
        current_hr = hr_data.get("current")
        if current_hr is None:
            return 0.0
        if current_hr < HR_CRITICAL_LOW:
            return 1.0
        if current_hr > HR_CRITICAL_HIGH:
            return 0.8
        if current_hr > HR_SPIKE_THRESHOLD:
            return 0.4
        return 0.0

    def _score_spo2(self, health: Optional[dict]) -> float:
        """Score based on blood oxygen levels."""
        if not health or not health.get("spo2"):
            return 0.0
        spo2 = health["spo2"]
        latest = spo2.get("latest") or spo2.get("average")
        if latest is None:
            return 0.0
        if latest < SPO2_CRITICAL:
            return 1.0
        if latest < 90:
            return 0.7
        if latest < 93:
            return 0.3
        return 0.0

    def _score_pattern(self, accel: list[AccelReading], gyro: list[GyroReading]) -> float:
        """Detect freefall-to-impact pattern, enhanced with gyro rotation spike."""
        if len(accel) < 3:
            return 0.0

        magnitudes = [r.magnitude for r in accel]
        found_freefall = False
        found_impact_after = False

        for i, mag in enumerate(magnitudes):
            if mag < FREEFALL_G:
                found_freefall = True
            elif found_freefall and mag >= IMPACT_G:
                found_impact_after = True
                break

        # Gyro confirms tumbling during the event
        gyro_spike = False
        if gyro:
            gyro_peak = max(r.magnitude for r in gyro)
            gyro_spike = gyro_peak >= GYRO_TUMBLE_THRESHOLD

        if found_freefall and found_impact_after and gyro_spike:
            return 1.0
        if found_freefall and found_impact_after:
            return 0.85
        if found_freefall and gyro_spike:
            return 0.5
        if found_freefall:
            return 0.3
        return 0.0


# Singleton
_detector: Optional[CollapseDetector] = None


def get_collapse_detector() -> CollapseDetector:
    global _detector
    if _detector is None:
        _detector = CollapseDetector()
    return _detector
