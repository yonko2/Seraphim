from typing import Any


class ReportProcessor:
    """Processes and formats emergency reports for TTS narration to emergency dispatchers."""

    def format_report(self, report_data: dict[str, Any]) -> str:
        """
        Format an emergency report as a spoken dispatch call.
        Tone: caller reporting an emergency to 911/112 dispatcher.
        """
        emergency_type = report_data.get("emergency_type", "unknown").replace("_", " ")
        severity = report_data.get("severity", "unknown")
        description = report_data.get("objective_description", "")
        actions = report_data.get("recommended_actions", [])
        location = report_data.get("location")
        health = report_data.get("health_data")

        parts = [
            "This is an automated emergency call from the Seraphim emergency detection system.",
            f"We have detected a {severity} severity {emergency_type} incident.",
        ]

        if description:
            parts.append(f"Situation report: {description}")

        if location:
            address = location.get("address")
            if address:
                parts.append(f"The incident is located at {address}.")
            else:
                lat = location.get("latitude")
                lon = location.get("longitude")
                if lat and lon:
                    parts.append(f"GPS coordinates are latitude {lat}, longitude {lon}.")

        if health:
            vitals = []
            if health.get("heartRate") is not None:
                vitals.append(f"heart rate {health['heartRate']} BPM")
            if health.get("bloodOxygen") is not None:
                vitals.append(f"blood oxygen {health['bloodOxygen']} percent")
            if vitals:
                parts.append(f"Victim vitals: {', '.join(vitals)}.")

        if actions:
            parts.append("On-scene responders should:")
            for i, action in enumerate(actions, 1):
                parts.append(f"{i}. {action}")

        parts.append("Please dispatch emergency services to this location immediately.")
        parts.append("This message will repeat. Listen to the voice note for full details.")

        return " ".join(parts)
