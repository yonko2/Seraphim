import asyncio
import os
import uuid
import logging
from telethon import TelegramClient
from telethon.tl.functions.phone import RequestCallRequest, DiscardCallRequest
from telethon.tl.types import (
    PhoneCallProtocol,
    PhoneCallDiscardReasonHangup,
)

logger = logging.getLogger("seraphim")


class TelegramCaller:
    """Handles Telegram voice calls using Telethon."""

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

    async def _ring_user(self, entity):
        """
        Initiate a Telegram call to make the user's phone ring.
        We ring for a few seconds then hang up, since we can't stream audio.
        """
        try:
            # Generate random bytes for g_a_hash (DH key exchange placeholder)
            g_a_hash = os.urandom(32)

            result = await self.client(RequestCallRequest(
                user_id=entity,
                random_id=int.from_bytes(os.urandom(4), 'big') % (2**31 - 1),
                g_a_hash=g_a_hash,
                protocol=PhoneCallProtocol(
                    min_layer=92,
                    max_layer=92,
                    udp_p2p=True,
                    udp_reflector=True,
                    library_versions=["location hidden"],
                ),
            ))

            phone_call = result.phone_call
            logger.info(f"Call initiated, ringing user... call_id={phone_call.id}")

            # Let it ring for 8 seconds
            await asyncio.sleep(8)

            # Hang up
            try:
                await self.client(DiscardCallRequest(
                    peer=phone_call,
                    duration=0,
                    reason=PhoneCallDiscardReasonHangup(),
                    connection_id=0,
                ))
                logger.info("Call disconnected after ringing")
            except Exception as e:
                logger.warning(f"Failed to discard call (may have been rejected): {e}")

        except Exception as e:
            logger.warning(f"Failed to initiate call (falling back to voice message): {e}")

    async def make_call(self, user_id, audio_path: str) -> str:
        """
        Alert the operator: ring their phone, then send voice message + text.
        """
        call_id = str(uuid.uuid4())

        try:
            entity = await self.client.get_entity(user_id)

            # Ring the user's phone (runs in background, don't block)
            asyncio.create_task(self._ring_user(entity))

            # Send voice message with the emergency report
            await self.client.send_file(
                entity,
                audio_path,
                voice_note=True,
                attributes=[]
            )

            # Send text alert
            await self.client.send_message(
                entity,
                "🚨 **SERAPHIM EMERGENCY ALERT** 🚨\n\n"
                "An emergency has been detected. Listen to the voice message above "
                "for the full report. This is an automated message from the Seraphim "
                "Emergency Assistant."
            )

            self.active_calls[call_id] = {
                "state": "completed",
                "user_id": str(user_id),
                "audio_path": audio_path,
                "message": "Call initiated and voice message sent",
            }

            return call_id

        except Exception as e:
            logger.error(f"make_call failed: {e}")
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
