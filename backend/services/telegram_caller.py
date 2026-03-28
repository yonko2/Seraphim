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


def convert_to_ogg(mp3_path: str, speed: float = 1.35) -> str:
    """Convert MP3 to OGG opus optimized for VoIP speech streaming.
    speed: playback speed multiplier (1.35 = 35% faster)."""
    ogg_path = mp3_path.rsplit(".", 1)[0] + ".ogg"
    try:
        af_filters = f"atempo={speed}" if speed != 1.0 else None
        cmd = [
            "ffmpeg", "-y", "-i", mp3_path,
        ]
        if af_filters:
            cmd += ["-af", af_filters]
        cmd += [
            "-c:a", "libopus", "-b:a", "48k",
            "-ar", "48000", "-ac", "1",
            "-application", "voip",
            "-frame_duration", "20",
            "-vbr", "on",
            ogg_path,
        ]
        subprocess.run(cmd, capture_output=True, check=True, timeout=30)
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

    async def make_call(self, user_id, audio_path: str, report_data: dict = None) -> str:
        """
        Emergency alert flow:
        1. Ring the operator via Telegram call and stream TTS audio
        2. Wait for stream to finish or call to be declined
        3. Send voice message with full TTS report (guaranteed delivery)
        4. Send text summary with emergency details
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

            # Step 1: Ring and stream audio — wait for it to complete
            call_connected = False
            call_done = asyncio.Event()

            async def on_stream_finished(client: PyTgCalls, update: StreamEnded):
                if update.chat_id == chat_id:
                    logger.info(f"📞 Stream finished for {chat_id}")
                    try:
                        await asyncio.sleep(1)
                        await client.leave_call(chat_id)
                    except Exception:
                        pass
                    call_done.set()

            async def on_call_discarded(client: PyTgCalls, update: ChatUpdate):
                if update.chat_id == chat_id:
                    logger.info(f"📞 Call ended/declined for {chat_id}")
                    call_done.set()

            # Register temporary handlers for this specific call
            self.pytgcalls.on_update(filters.stream_end())(on_stream_finished)
            self.pytgcalls.on_update(filters.chat_update(ChatUpdate.Status.DISCARDED_CALL))(on_call_discarded)

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
                logger.info(f"📞 Call ringing {user_id} — waiting for audio to finish")

                # Wait up to 120s for the call to complete (stream end or declined)
                try:
                    await asyncio.wait_for(call_done.wait(), timeout=120)
                except asyncio.TimeoutError:
                    logger.warning(f"📞 Call timeout for {chat_id}, leaving call")
                    try:
                        await self.pytgcalls.leave_call(chat_id)
                    except Exception:
                        pass

            except Exception as e:
                logger.warning(f"📞 Call attempt failed: {e}")

            self.active_calls[call_id] = {
                "state": "alerting",
                "user_id": str(user_id),
                "call_connected": call_connected,
                "message": "Alerting operator",
            }

            # Step 2: Send voice message (always works — reliable report delivery)
            await self.client.send_file(
                entity, audio_path, voice_note=True, attributes=[]
            )
            logger.info(f"🔊 Voice message sent to {user_id}")

            # Step 3: Send text alert with emergency details
            text_msg = self._format_telegram_message(report_data)
            await self.client.send_message(entity, text_msg)
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

    def _format_telegram_message(self, report_data: dict = None) -> str:
        """Compact emergency dispatch message for Telegram."""
        if not report_data:
            return "🚨 **EMERGENCY** — Details in voice message above."

        etype = report_data.get("emergency_type", "unknown").replace("_", " ").upper()
        severity = report_data.get("severity", "unknown").upper()
        description = report_data.get("objective_description", "")
        location = report_data.get("location")
        victim = report_data.get("victim_profile") or {}

        icon_map = {
            "FIRE": "🔥", "FLOOD": "🌊", "EARTHQUAKE": "🏚️", "FALL": "🤕",
            "CAR CRASH": "🚗", "MEDICAL": "🏥", "VIOLENCE": "⚠️",
        }
        icon = icon_map.get(etype, "🚨")

        lines = [
            f"🚨 **{etype}** — {severity}",
        ]

        # Victim info
        victim_parts = []
        if victim.get("name"):
            victim_parts.append(victim["name"])
        if victim.get("age"):
            victim_parts.append(f"age {victim['age']}")
        if victim.get("blood_type"):
            victim_parts.append(f"blood type {victim['blood_type']}")
        if victim_parts:
            lines.append(f"👤 {', '.join(victim_parts)}")

        if victim.get("conditions"):
            lines.append(f"🏥 Conditions: {', '.join(victim['conditions'])}")

        if victim.get("allergies"):
            lines.append(f"⚠️ Allergies: {', '.join(victim['allergies'])}")

        if victim.get("medications"):
            lines.append(f"💊 Medications: {', '.join(victim['medications'])}")

        if location:
            address = location.get("address")
            if address:
                lines.append(f"📍 {address}")
            else:
                lat = location.get("latitude")
                lon = location.get("longitude")
                if lat and lon:
                    lines.append(f"📍 {lat}, {lon}")

        if description:
            lines.append(f"{icon} {description}")

        if victim.get("emergency_contact"):
            lines.append(f"📞 Emergency contact: {victim['emergency_contact']}")

        return "\n".join(lines)

    async def get_call_status(self, call_id: str) -> dict:
        if call_id in self.active_calls:
            return self.active_calls[call_id]
        return {"state": "not_found", "message": "Call not found"}
