from typing import Any


class ReportProcessor:
    """Processes and formats emergency reports for TTS narration."""

    def format_report(self, report_data: dict[str, Any]) -> str:
        """
        Format an emergency report into a clear, narration-ready text.
        Designed to be read aloud by TTS during an emergency call.
        """
        parts = [
            "Emergency Alert from Seraphim Emergency Assistant.",
            "",
        ]

        # Emergency type and severity
        emergency_type = report_data.get("emergency_type", "unknown").replace("_", " ")
        severity = report_data.get("severity", "unknown")
        parts.append(f"Emergency type: {emergency_type}.")
        parts.append(f"Severity level: {severity}.")
        parts.append("")

        # Location
        location = report_data.get("location")
        if location:
            lat = location.get("latitude", "unknown")
            lon = location.get("longitude", "unknown")
            address = location.get("address")
            if address:
                parts.append(f"Location: {address}.")
            else:
                parts.append(f"GPS coordinates: latitude {lat}, longitude {lon}.")
            parts.append("")

        # Objective description
        description = report_data.get("objective_description", "")
        if description:
            parts.append(f"Situation description: {description}")
            parts.append("")

        # Health data
        health = report_data.get("health_data")
        if health:
            parts.append("Victim health data:")
            if health.get("heartRate") is not None:
                parts.append(f"  Heart rate: {health['heartRate']} beats per minute.")
            if health.get("bloodOxygen") is not None:
                parts.append(f"  Blood oxygen: {health['bloodOxygen']} percent.")
            if health.get("bloodGlucose") is not None:
                parts.append(f"  Blood glucose: {health['bloodGlucose']} milligrams per deciliter.")
            parts.append("")

        # Recommended actions
        actions = report_data.get("recommended_actions", [])
        if actions:
            parts.append("Recommended actions:")
            for i, action in enumerate(actions, 1):
                parts.append(f"  {i}. {action}")
            parts.append("")

        parts.append("End of emergency report. Please dispatch emergency services immediately.")

        return " ".join(parts)
