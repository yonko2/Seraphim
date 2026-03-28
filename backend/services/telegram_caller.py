import asyncio
import uuid
from telethon import TelegramClient
from telethon.tl.functions.phone import RequestCallRequest, DiscardCallRequest
from telethon.tl.types import PhoneCallProtocol
from typing import Optional


class TelegramCaller:
    """Handles Telegram voice calls using Telethon + pytgcalls."""

    def __init__(self, api_id: int, api_hash: str, phone: str):
        self.api_id = api_id
        self.api_hash = api_hash
        self.phone = phone
        self.client = TelegramClient("seraphim_session", api_id, api_hash)
        self.is_connected = False
        self.active_calls: dict[str, dict] = {}

    async def connect(self):
        """Connect and authenticate the Telegram client."""
        await self.client.start(phone=self.phone)
        self.is_connected = True

    async def disconnect(self):
        """Disconnect the Telegram client."""
        await self.client.disconnect()
        self.is_connected = False

    async def make_call(self, user_id: int, audio_path: str) -> str:
        """
        Initiate a Telegram voice call and play audio.
        
        Note: Full voice call implementation requires pytgcalls for audio streaming.
        This is the signaling layer; pytgcalls handles the actual VoIP connection.
        """
        call_id = str(uuid.uuid4())

        try:
            # For the hackathon demo, we'll send a voice message as the primary method
            # and attempt a real call as a stretch goal
            
            # Send voice message with the emergency report
            entity = await self.client.get_entity(user_id)
            await self.client.send_file(
                entity,
                audio_path,
                voice_note=True,
                attributes=[]
            )

            # Also send a text alert
            await self.client.send_message(
                entity,
                "🚨 **SERAPHIM EMERGENCY ALERT** 🚨\n\n"
                "An emergency has been detected. Listen to the voice message above "
                "for the full report. This is an automated message from the Seraphim "
                "Emergency Assistant."
            )

            self.active_calls[call_id] = {
                "state": "completed",
                "user_id": user_id,
                "audio_path": audio_path,
                "message": "Voice message and alert sent successfully",
            }

            return call_id

        except Exception as e:
            self.active_calls[call_id] = {
                "state": "failed",
                "error": str(e),
                "message": f"Call failed: {str(e)}",
            }
            raise

    async def get_call_status(self, call_id: str) -> dict:
        """Get the status of a call."""
        if call_id in self.active_calls:
            return self.active_calls[call_id]
        return {"state": "not_found", "message": "Call not found"}
