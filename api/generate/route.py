"""
Vercel Serverless Function for background generation.
Uses Gemini API to generate carousel slide backgrounds.
"""
import os
import json
import base64
from http.server import BaseHTTPRequestHandler
from google import genai
from google.genai import types
from io import BytesIO
from PIL import Image

# Gemini API configuration
API_KEY = os.environ.get('GEMINI_API_KEY', 'AIzaSyCczsgGQ_9AtGxfIP8BKyvAEZ-AwdUw5kM')
DEFAULT_MODEL = "gemini-3-pro-image-preview"

# Trope prompts for different slide types
TROPE_PROMPTS = {
    'hook': """Dark atmospheric background for book marketing slide.
        Deep moody tones with subtle red accents.
        Leave LEFT SIDE (40% width) empty for text overlay.
        Place 3D book in BOTTOM-RIGHT corner, small (20% of width).
        The book should match the reference cover image.
        Clean, professional. No text, no UI. Format: 1080x1350 (4:5)""",

    'audience': """Dark gradient background for book marketing slide.
        Smooth vertical gradient from dark gray #2a2a2a at top to almost black #1a1a1a at bottom.
        Leave TOP-LEFT area (60% width, 65% height) completely EMPTY for text overlay.
        Place 3D book in BOTTOM-RIGHT corner (25% of width).
        The book should match the reference cover image.
        Clean, minimal. No text, no UI. Format: 1080x1350 (4:5)""",

    'about': """Atmospheric dark background with abstract ethereal shapes.
        Deep blue-black tones with subtle light rays.
        CENTER should be mostly clear for text overlay.
        Place 3D book at BOTTOM CENTER, medium size (30% of height).
        The book should match the reference cover image.
        Cinematic mood. No text. Format: 1080x1350 (4:5)""",

    'author': """Elegant dark background for author biography slide.
        Subtle gradient from dark charcoal to black.
        Professional, sophisticated feel.
        Leave TOP 60% mostly empty for photo placeholder and text.
        Place 3D book in BOTTOM-RIGHT corner, small (20% width).
        The book should match the reference cover image.
        No text, no UI. Format: 1080x1350 (4:5)""",

    'specs': """Clean dark background for book specifications.
        Minimal gradient from #2a2a2a to #1a1a1a.
        Leave LEFT SIDE (50% width) empty for specs list.
        Place 3D book in RIGHT SIDE, medium size.
        The book should match the reference cover image.
        Professional, clean. No text. Format: 1080x1350 (4:5)""",

    'cta': """Dramatic spotlight background for call-to-action slide.
        Very dark base (#0a0a15) with warm red/crimson spotlight from below.
        The spotlight should illuminate the CENTER area.
        Place 3D book prominently in CENTER, large (40% of image height).
        The book should match the reference cover image and appear glowing.
        Dramatic, urgent lighting. Leave space at bottom for button.
        No text, no UI. Format: 1080x1350 (4:5)""",

    'default': """Dark professional gradient background for book marketing.
        Smooth gradient from #2a2a2a to #1a1a1a.
        Place 3D book in bottom-right corner.
        The book should match the reference cover image.
        Clean, minimal. No text. Format: 1080x1350 (4:5)"""
}


def generate_background(prompt: str, cover_data: bytes) -> bytes:
    """Generate a single background image using Gemini."""
    try:
        # Initialize Gemini client
        client = genai.Client(api_key=API_KEY)

        # Convert cover to base64 for reference
        cover_image = Image.open(BytesIO(cover_data))

        # Save to BytesIO for upload
        cover_buffer = BytesIO()
        cover_image.save(cover_buffer, format='PNG')
        cover_buffer.seek(0)

        # Upload reference image
        cover_file = client.files.upload(path=cover_buffer)

        # Generate with reference
        response = client.models.generate_image(
            model=DEFAULT_MODEL,
            prompt=prompt,
            image=types.Image(image_file=cover_file),
            config=types.GenerateImageConfig(
                aspect_ratio="4:5",
                safety_filter_level="block_only_high",
                person_generation="allow_all"
            )
        )

        # Get generated image
        if response.images and len(response.images) > 0:
            img_data = response.images[0].image.data

            # Convert to PNG bytes
            img = Image.open(BytesIO(img_data))
            output = BytesIO()
            img.save(output, format='PNG')
            return output.getvalue()
        else:
            raise Exception("No image generated")

    except Exception as e:
        print(f"Generation error: {e}")
        raise


class handler(BaseHTTPRequestHandler):
    """Vercel serverless function handler."""

    def do_POST(self):
        try:
            # Parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            slide_type = data.get('slideType', 'default')
            cover_base64 = data.get('coverData')

            if not cover_base64:
                self.send_error(400, "Missing coverData")
                return

            # Decode cover image
            cover_data = base64.b64decode(cover_base64)

            # Get prompt for slide type
            prompt = TROPE_PROMPTS.get(slide_type, TROPE_PROMPTS['default'])

            # Generate background
            result_data = generate_background(prompt, cover_data)

            # Encode result as base64
            result_base64 = base64.b64encode(result_data).decode('utf-8')

            # Send response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

            response = {
                'success': True,
                'imageData': result_base64,
                'slideType': slide_type
            }

            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

            error_response = {
                'success': False,
                'error': str(e)
            }

            self.wfile.write(json.dumps(error_response).encode())
