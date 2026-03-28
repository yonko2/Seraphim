import os
import uuid
import asyncio
from gtts import gTTS


class TTSService:
    """Text-to-Speech service using gTTS (Google Translate TTS)."""

    def __init__(self, output_dir: str = "audio", language: str = "en"):
        self.output_dir = output_dir
        self.language = language
        os.makedirs(output_dir, exist_ok=True)

    async def generate_audio(self, text: str, language: str = None) -> str:
        """
        Convert text to speech and save as audio file.
        Returns the path to the generated audio file.
        """
        lang = language or self.language
        filename = f"emergency_{uuid.uuid4().hex[:8]}.mp3"
        filepath = os.path.join(self.output_dir, filename)

        # gTTS is synchronous, run in executor
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._generate_sync, text, lang, filepath)

        return filepath

    def _generate_sync(self, text: str, language: str, filepath: str):
        """Synchronous TTS generation."""
        tts = gTTS(text=text, lang=language, slow=False)
        tts.save(filepath)

    def cleanup_audio(self, filepath: str):
        """Remove a generated audio file."""
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except OSError:
            pass
