import asyncio
import os
import uuid
import logging
import subprocess
from telethon import TelegramClient
from pytgcalls import PyTgCalls
from pytgcalls.types import MediaStream, ChatUpdate, StreamEnded, CallConfig
from pytgcalls import filters

logger = logging.getLogger("seraphim")


def convert_to_ogg(mp3_path: str) -> str:
    """Convert MP3 to OGG opus optimized for VoIP speech streaming."""
    ogg_path = mp3_path.rsplit(".", 1)[0] + ".ogg"
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", mp3_path,
                "-c:a", "libopus", "-b:a", "48k",
                "-ar", "48000", "-ac", "1",
                "-application", "voip",
                "-frame_duration", "20",
                "-vbr", "on",
                ogg_path,
            ],
            capture_output=True, check=True, timeout=30,
        )
        return ogg_path
    except Exception:
        return mp3_path


class TelegramCaller:
    """Handles Telegram emergency alerts: call (attention) + voice message (report)."""

    def __init__(self, api_id: int, api_hash: str, phone: str):
        self.api_id = api_id
        self.api_hash = api_hash
        self.phone = phone
        self.client = TelegramClient("seraphim_session", api_id, api_hash)
        self.pytgcalls: PyTgCalls | None = None
        self.is_connected = False
        self.active_calls: dict[str, dict] = {}

    async def connect(self):
        """Connect and authenticate the Telegram client."""
        await self.client.start(phone=self.phone)
        self.pytgcalls = PyTgCalls(self.client)

        @self.pytgcalls.on_update(filters.stream_end())
        async def on_stream_end(client: PyTgCalls, update: StreamEnded):
            logger.info(f"Stream ended in chat {update.chat_id}")
            try:
                await asyncio.sleep(1)
                await client.leave_call(update.chat_id)
            except Exception:
                pass

        @self.pytgcalls.on_update(filters.chat_update(ChatUpdate.Status.DISCARDED_CALL))
        async def on_discarded(client: PyTgCalls, update: ChatUpdate):
            logger.info(f"Call ended in chat {update.chat_id}")

        await self.pytgcalls.start()
        self.is_connected = True

    async def disconnect(self):
        """Disconnect the Telegram client."""
        await self.client.disconnect()
        self.is_connected = False

    async def make_call(self, user_id, audio_path: str) -> str:
        """
        Emergency alert flow:
        1. Ring the operator via Telegram call (grabs attention, may stream audio)
        2. Send voice message with full TTS report (guaranteed delivery)
        3. Send text summary
        """
        call_id = str(uuid.uuid4())

        try:
            entity = await self.client.get_entity(user_id)
            chat_id = entity.id
            logger.info(f"🚨 Emergency alert to {user_id} (chat_id={chat_id})")

            # Convert for VoIP
            stream_path = await asyncio.get_event_loop().run_in_executor(
                None, convert_to_ogg, audio_path
            )

            # Step 1: Ring the operator (best-effort VoIP audio)
            call_connected = False
            try:
                await self.pytgcalls.play(
                    chat_id,
                    MediaStream(
                        stream_path,
                        video_flags=MediaStream.Flags.IGNORE,
                    ),
                    config=CallConfig(timeout=30),
                )
                call_connected = True
                logger.info(f"📞 Call ringing {user_id} — VoIP audio may play")
            except Exception as e:
                logger.warning(f"📞 Call attempt failed: {e}")

            self.active_calls[call_id] = {
                "state": "alerting",
                "user_id": str(user_id),
                "call_connected": call_connected,
                "message": "Alerting operator",
            }

            # Step 2: Send voice message (always works — this is the reliable report delivery)
            await self.client.send_file(
                entity, audio_path, voice_note=True, attributes=[]
            )
            logger.info(f"🔊 Voice message sent to {user_id}")

            # Step 3: Send text alert
            await self.client.send_message(
                entity,
                "🚨 **SERAPHIM EMERGENCY ALERT** 🚨\n\n"
                "An emergency has been detected. "
                "▶️ **Play the voice message above** for the full emergency report.\n\n"
                "This is an automated alert from the Seraphim Emergency Assistant.",
            )
            logger.info(f"📝 Text alert sent to {user_id}")

            self.active_calls[call_id] = {
                "state": "completed",
                "user_id": str(user_id),
                "call_connected": call_connected,
                "message": "Emergency alert delivered (call + voice message + text)",
            }
            return call_id

        except Exception as e:
            logger.error(f"make_call failed: {e}")
            import traceback
            traceback.print_exc()
            self.active_calls[call_id] = {
                "state": "failed",
                "error": str(e),
                "message": f"Alert failed: {str(e)}",
            }
            raise

    async def get_call_status(self, call_id: str) -> dict:
        if call_id in self.active_calls:
            return self.active_calls[call_id]
        return {"state": "not_found", "message": "Call not found"}
