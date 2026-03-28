from typing import Any


class ReportProcessor:
    """Processes and formats emergency reports for TTS dispatch narration."""

    def format_report(self, report_data: dict[str, Any]) -> str:
        """Ultra-concise dispatch narration for TTS voice call."""
        etype = report_data.get("emergency_type", "unknown").replace("_", " ")
        severity = report_data.get("severity", "unknown")
        description = report_data.get("objective_description", "")
        location = report_data.get("location")

        parts = [
            f"Emergency. {etype}. Severity {severity}.",
        ]

        if location:
            address = location.get("address")
            if address:
                parts.append(f"Location: {address}.")
            else:
                lat = location.get("latitude")
                lon = location.get("longitude")
                if lat and lon:
                    parts.append(f"Coordinates: {lat}, {lon}.")

        if description:
            parts.append(description)

        parts.append("Dispatch immediately.")

        return " ".join(parts)
