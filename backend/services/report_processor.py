from typing import Any


class ReportProcessor:
    """Processes and formats emergency reports for TTS dispatch narration."""

    def format_report(self, report_data: dict[str, Any]) -> str:
        """Ultra-concise dispatch narration for TTS voice call."""
        etype = report_data.get("emergency_type", "unknown").replace("_", " ")
        severity = report_data.get("severity", "unknown")
        description = report_data.get("objective_description", "")
        location = report_data.get("location")
        victim = report_data.get("victim_profile") or {}

        parts = [
            f"Emergency. {etype}. Severity {severity}.",
        ]

        # Victim identification
        victim_info = []
        if victim.get("name"):
            victim_info.append(victim["name"])
        if victim.get("age"):
            victim_info.append(f"age {victim['age']}")
        if victim.get("blood_type"):
            victim_info.append(f"blood type {victim['blood_type']}")
        if victim_info:
            parts.append(f"Patient: {', '.join(victim_info)}.")

        # Medical conditions
        conditions = victim.get("conditions")
        if conditions:
            parts.append(f"Known conditions: {', '.join(conditions)}.")

        allergies = victim.get("allergies")
        if allergies:
            parts.append(f"Allergies: {', '.join(allergies)}.")

        medications = victim.get("medications")
        if medications:
            parts.append(f"Current medications: {', '.join(medications)}.")

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

        # Emergency contact
        if victim.get("emergency_contact"):
            parts.append(f"Emergency contact: {victim['emergency_contact']}.")

        if victim.get("notes"):
            parts.append(f"Additional notes: {victim['notes']}.")

        parts.append("Dispatch immediately.")

        return " ".join(parts)
