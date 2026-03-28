import os
import re
import io
import json
import base64
import logging
import asyncio
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

logger = logging.getLogger("seraphim")


class RateLimitError(Exception):
    """Raised when the AI API returns a 429 quota-exceeded response."""
    def __init__(self, message: str, retry_after_seconds: float = 60.0):
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


# Try Groq SDK (primary)
try:
    from groq import AsyncGroq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

# Try Gemini SDK (fallback)
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


class GeminiService:
    """AI Vision service for emergency classification. Uses Groq (primary) or Gemini (fallback)."""

    MAX_RETRIES = 2
    BASE_BACKOFF_MS = 1000

    def __init__(self):
        self.provider: Optional[str] = None
        self.groq_client: Optional[Any] = None
        self.gemini_model: Optional[Any] = None

        groq_key = os.getenv("GROQ_API_KEY")
        gemini_key = os.getenv("GEMINI_API_KEY")

        # Prefer Groq if available
        if groq_key and GROQ_AVAILABLE:
            self.groq_client = AsyncGroq(api_key=groq_key)
            self.provider = "groq"
            logger.info(f"Vision AI initialized: Groq ({GROQ_MODEL})")
        elif gemini_key and GEMINI_AVAILABLE:
            genai.configure(api_key=gemini_key)
            self.gemini_model = genai.GenerativeModel("gemini-2.0-flash-lite")
            self.provider = "gemini"
            logger.info("Vision AI initialized: Gemini (flash-lite)")
        else:
            if not groq_key and not gemini_key:
                logger.warning("No AI API key configured. Set GROQ_API_KEY or GEMINI_API_KEY in .env")
            elif groq_key and not GROQ_AVAILABLE:
                logger.warning("GROQ_API_KEY set but 'groq' package missing - pip install groq")
            elif gemini_key and not GEMINI_AVAILABLE:
                logger.warning("GEMINI_API_KEY set but 'google-generativeai' missing")

    def is_available(self) -> bool:
        return self.provider is not None

    # -- Groq helpers ----------------------------------------------------------

    async def _groq_chat(self, messages: List[Dict], json_mode: bool = False) -> str:
        """Send a chat completion request to Groq and return the text response."""
        kwargs: Dict[str, Any] = {
            "model": GROQ_MODEL,
            "messages": messages,
            "temperature": 0.3,
            "max_completion_tokens": 2048,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        response = await self.groq_client.chat.completions.create(**kwargs)
        return response.choices[0].message.content.strip()

    async def _groq_vision(self, base64_image: str, prompt: str, json_mode: bool = True) -> str:
        """Send an image + prompt to Groq vision and return the text response."""
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        },
                    },
                ],
            }
        ]
        return await self._groq_chat(messages, json_mode=json_mode)

    async def _groq_text(self, prompt: str, json_mode: bool = False) -> str:
        """Send a text-only prompt to Groq and return the response."""
        messages = [{"role": "user", "content": prompt}]
        return await self._groq_chat(messages, json_mode=json_mode)

    # -- Public API ------------------------------------------------------------

    async def analyze_image(self, base64_image: str) -> Dict[str, Any]:
        """Analyze an image for emergency situations."""
        if not self.provider:
            raise RuntimeError("AI service not initialized. Set GROQ_API_KEY or GEMINI_API_KEY in .env")

        prompt = """You are an emergency detection AI. Analyze this image objectively and determine if there is a real emergency situation visible.

Emergency types to look for:
- fire: flames, smoke, burning structures or objects
- flood: rising water, submerged areas, water damage
- earthquake: collapsed buildings, cracked ground, structural damage, debris
- car_crash: vehicle collisions, overturned cars, road accidents
- medical: seizures, unconscious person, choking, allergic reactions, bleeding, broken bones, visible fractures or deformed limbs
- violence: physical assault, fighting, weapons
- fall: person who has clearly fallen and is injured or unable to get up
- none: no emergency — normal everyday scene

IMPORTANT: Only flag an emergency if you can clearly see evidence of one. A person simply standing, walking, or sitting is NOT an emergency. Be accurate, not paranoid.

Respond ONLY with valid JSON (no markdown, no backticks):
{
    "emergency": true/false,
    "type": "fire|flood|earthquake|car_crash|medical|violence|fall|none",
    "severity": "critical|high|medium|low|none",
    "confidence": 85,
    "title": "EMERGENCY DETECTED" or "NO EMERGENCY",
    "description": "Brief objective description of what you see",
    "icon": "🔥|🌊|🏚️|🚗|🏥|⚠️|🤕|✅",
    "instructions": ["Step 1", "Step 2", "Step 3"] or []
}

If emergency is detected, provide 3-5 immediate action instructions.
If no emergency, set type to "none" and instructions to empty array."""

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                if self.provider == "groq":
                    text = await self._groq_vision(base64_image, prompt, json_mode=True)
                else:
                    response = self.gemini_model.generate_content([
                        prompt,
                        {"inline_data": {"mime_type": "image/jpeg", "data": base64_image}},
                    ])
                    text = response.text.strip()

                parsed = self._parse_json(text)
                return self._format_response(parsed)

            except Exception as e:
                retry_after = self._extract_retry_after(e)
                if retry_after is not None:
                    raise RateLimitError(str(e), retry_after_seconds=retry_after)
                logger.warning(f"Image analysis attempt {attempt + 1} failed: {e}")
                if attempt < self.MAX_RETRIES:
                    backoff = self.BASE_BACKOFF_MS * (2 ** attempt) / 1000.0
                    await asyncio.sleep(backoff)
                else:
                    raise

        raise RuntimeError("All retry attempts failed")

    async def get_first_aid_guidance(self, emergency_type: str, description: str) -> List[str]:
        """Generate context-specific first aid guidance."""
        if not self.provider:
            raise RuntimeError("AI service not initialized. Set GROQ_API_KEY or GEMINI_API_KEY in .env")

        prompt = f"""You are an emergency first aid expert. A bystander has encountered the following emergency:

Type: {emergency_type}
Description: {description}

Provide 5-8 clear, actionable first aid steps that a non-medical person can follow immediately.
Each step should be one concise sentence.
Prioritize life-saving actions first, then comfort/stabilization.
Do NOT suggest actions requiring medical equipment unless commonly available (e.g., AED).
Do NOT include "call emergency services" or "call 911/112" — that is already handled automatically.

Respond ONLY with a valid JSON array of strings (no markdown, no backticks):
["Step 1 text", "Step 2 text", "Step 3 text", ...]"""

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                if self.provider == "groq":
                    text = await self._groq_text(prompt, json_mode=True)
                else:
                    response = self.gemini_model.generate_content(prompt)
                    text = response.text.strip()

                parsed = self._parse_json(text)
                if isinstance(parsed, list):
                    return [str(s) for s in parsed if isinstance(s, str)]
                return parsed.get("steps", [])

            except Exception as e:
                retry_after = self._extract_retry_after(e)
                if retry_after is not None:
                    raise RateLimitError(str(e), retry_after_seconds=retry_after)
                logger.warning(f"First aid guidance attempt {attempt + 1} failed: {e}")
                if attempt < self.MAX_RETRIES:
                    backoff = self.BASE_BACKOFF_MS * (2 ** attempt) / 1000.0
                    await asyncio.sleep(backoff)
                else:
                    raise

        raise RuntimeError("All retry attempts failed")

    async def filter_panic(self, raw_text: str) -> str:
        """Rewrite panicked text as objective, calm observations."""
        if not self.provider:
            raise RuntimeError("AI service not initialized. Set GROQ_API_KEY or GEMINI_API_KEY in .env")

        prompt = f"""You are an emergency report processor. Rewrite the following observations into calm, objective, factual language suitable for emergency dispatchers. Remove all emotional language, panic, exclamations, and subjective feelings. Keep only actionable facts.

Raw observations:
{raw_text}

Respond with ONLY the rewritten text. No markdown, no labels, no extra formatting."""

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                if self.provider == "groq":
                    return await self._groq_text(prompt)
                else:
                    response = self.gemini_model.generate_content(prompt)
                    return response.text.strip()

            except Exception as e:
                retry_after = self._extract_retry_after(e)
                if retry_after is not None:
                    raise RateLimitError(str(e), retry_after_seconds=retry_after)
                logger.warning(f"Panic filter attempt {attempt + 1} failed: {e}")
                if attempt < self.MAX_RETRIES:
                    backoff = self.BASE_BACKOFF_MS * (2 ** attempt) / 1000.0
                    await asyncio.sleep(backoff)
                else:
                    raise

        raise RuntimeError("All retry attempts failed")

    async def analyze_video_frames(self, frames: List[str]) -> Dict[str, Any]:
        """Analyze multiple video frames by stitching them into a single grid image."""
        if not self.provider:
            raise RuntimeError("AI service not initialized. Set GROQ_API_KEY or GEMINI_API_KEY in .env")

        # Stitch all frames into one labeled grid image
        grid_b64 = self._stitch_frames(frames)
        logger.info(f"Stitched {len(frames)} frames into a single grid image")

        prompt = f"""You are an emergency detection AI. This image is a grid of {len(frames)} consecutive video frames arranged left-to-right, top-to-bottom.

Analyze ALL frames in chronological order. Look for changes over time that indicate a real emergency.

Emergency types to look for:
- fire: flames appearing/spreading, smoke increasing
- flood: water rising, areas becoming submerged
- earthquake: buildings shaking/collapsing, ground cracking, debris falling
- car_crash: vehicles colliding, spinning out, overturning
- medical: person having a seizure, collapsing unconscious, choking, visible injuries, broken/deformed limbs, heavy bleeding
- violence: physical assault, fighting escalating, weapons visible
- fall: person falling and remaining on the ground injured
- none: no emergency — normal activity

IMPORTANT: Only flag an emergency if the frames clearly show one happening. People simply walking, standing, sitting, or going about normal activities is NOT an emergency. Be accurate, not paranoid.

Do NOT reference frame numbers in your response. Write in plain language.

Respond ONLY with valid JSON (no markdown, no backticks):
{{
    "emergency": true/false,
    "type": "fire|flood|earthquake|car_crash|medical|violence|fall|none",
    "severity": "critical|high|medium|low|none",
    "confidence": 85,
    "title": "EMERGENCY DETECTED" or "NO EMERGENCY",
    "description": "Plain language description of what is happening across the video",
    "icon": "🔥|🌊|🏚️|🚗|🏥|⚠️|🤕|✅",
    "instructions": ["Step 1", "Step 2", "Step 3"] or []
}}

If emergency is detected, provide 3-5 clear actionable instructions.
If no emergency, set type to "none" and instructions to empty array."""

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                if self.provider == "groq":
                    # Use system + user messages so analysis stays internal
                    system_msg = (
                        "You are an objective emergency detection AI. Analyze video frame grids carefully. "
                        "Only flag real emergencies you can clearly see. Normal human activity is NOT an emergency. "
                        "Never mention frame numbers in your output."
                    )
                    messages = [
                        {"role": "system", "content": system_msg},
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{grid_b64}"}},
                            ],
                        },
                    ]
                    text = await self._groq_chat(messages, json_mode=True)
                else:
                    response = self.gemini_model.generate_content([
                        prompt,
                        {"inline_data": {"mime_type": "image/jpeg", "data": grid_b64}},
                    ])
                    text = response.text.strip()

                parsed = self._parse_json(text)
                return self._format_response(parsed)

            except Exception as e:
                retry_after = self._extract_retry_after(e)
                if retry_after is not None:
                    raise RateLimitError(str(e), retry_after_seconds=retry_after)
                logger.warning(f"Video analysis attempt {attempt + 1} failed: {e}")
                if attempt < self.MAX_RETRIES:
                    backoff = self.BASE_BACKOFF_MS * (2 ** attempt) / 1000.0
                    await asyncio.sleep(backoff)
                else:
                    raise

        raise RuntimeError("All retry attempts failed")

    def _stitch_frames(self, frames_b64: List[str]) -> str:
        """Stitch multiple base64 frames into a single labeled grid image, returned as base64."""
        images = []
        for b64 in frames_b64:
            img = Image.open(io.BytesIO(base64.b64decode(b64)))
            images.append(img)

        if not images:
            raise ValueError("No valid frames to stitch")

        n = len(images)
        logger.info(f"Stitching {n} frames into grid")

        # Scale grid dynamically: keep total image under ~4000px wide
        import math
        cols = min(n, max(4, int(math.ceil(math.sqrt(n)))))
        rows = math.ceil(n / cols)

        # Scale cell size so grid stays reasonable for the AI
        # Target: grid max ~3200px wide, cells at least 200px wide
        cell_w = max(200, min(400, 3200 // cols))
        cell_h = int(cell_w * 0.75)  # 4:3 aspect ratio
        label_h = 24

        grid_w = cols * cell_w
        grid_h = rows * (cell_h + label_h)
        grid = Image.new("RGB", (grid_w, grid_h), (0, 0, 0))

        try:
            from PIL import ImageDraw, ImageFont
            draw = ImageDraw.Draw(grid)
            try:
                font = ImageFont.truetype("arial.ttf", max(14, label_h - 8))
            except (IOError, OSError):
                font = ImageFont.load_default()
        except ImportError:
            draw = None
            font = None

        for i, img in enumerate(images):
            r, c = divmod(i, cols)
            resized = img.resize((cell_w, cell_h), Image.LANCZOS)
            x = c * cell_w
            y = r * (cell_h + label_h) + label_h
            grid.paste(resized, (x, y))

            if draw and font:
                label = f"Frame {i + 1}"
                draw.rectangle([x, y - label_h, x + cell_w, y], fill=(30, 30, 30))
                draw.text((x + 4, y - label_h + 3), label, fill=(255, 255, 255), font=font)

        buf = io.BytesIO()
        grid.save(buf, format="JPEG", quality=75)
        size_kb = buf.tell() / 1024
        logger.info(f"Grid image: {grid_w}x{grid_h}, {cols}x{rows}, {size_kb:.0f}KB")
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    # -- Response formatting ---------------------------------------------------

    def _format_response(self, parsed: Dict[str, Any]) -> Dict[str, Any]:
        """Format and validate the response."""
        emergency_type = parsed.get("type", "none").lower()
        severity = parsed.get("severity", "medium").lower()
        confidence = float(parsed.get("confidence", 50))

        valid_types = ["fire", "flood", "earthquake", "fall", "car_crash", "medical", "violence", "none"]
        if emergency_type not in valid_types:
            emergency_type = "none"

        valid_severities = ["critical", "high", "medium", "low", "none"]
        if severity not in valid_severities:
            severity = "medium"

        confidence = max(0, min(100, confidence))
        is_emergency = emergency_type != "none" and severity != "none"

        icon_map = {
            "fire": "🔥", "flood": "🌊", "earthquake": "🏚️", "fall": "🤕",
            "car_crash": "🚗", "medical": "🏥", "violence": "⚠️", "none": "✅",
        }

        instructions = parsed.get("instructions", [])
        if not isinstance(instructions, list):
            instructions = []

        return {
            "emergency": is_emergency,
            "type": emergency_type,
            "severity": severity,
            "confidence": confidence,
            "title": parsed.get("title", "EMERGENCY DETECTED" if is_emergency else "NO EMERGENCY"),
            "description": parsed.get("description", "Unable to analyze image"),
            "icon": icon_map.get(emergency_type, "⚠️"),
            "instructions": instructions,
        }

    def _parse_json(self, raw: str) -> Any:
        """Parse JSON from response, handling markdown code fences."""
        cleaned = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.IGNORECASE)
        cleaned = re.sub(r'\s*```$', '', cleaned)
        cleaned = re.sub(r',\s*([}\]])', r'\1', cleaned)

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON: {raw}")
            raise ValueError(f"Invalid JSON response: {e}")

    def _extract_retry_after(self, exc: Exception) -> Optional[float]:
        """Extract retry-after seconds from a 429 error, or None if not a rate limit."""
        msg = str(exc)
        if "429" not in msg and "quota" not in msg.lower() and "rate" not in msg.lower():
            return None
        m = re.search(r'retry in (\d+(?:\.\d+)?)s', msg, re.IGNORECASE)
        if m:
            return float(m.group(1)) + 2.0
        m = re.search(r'retry_delay\s*\{[^}]*seconds:\s*(\d+)', msg, re.DOTALL)
        if m:
            return float(m.group(1)) + 2.0
        return 60.0



# Global singleton
_gemini_service: Optional[GeminiService] = None


def get_gemini_service() -> GeminiService:
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service
