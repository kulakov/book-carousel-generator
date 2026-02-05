#!/usr/bin/env python3
"""
Flask server for carousel background generation.
Uses Nano Banana module for Gemini image generation.
"""

import sys
import os
import json
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from pathlib import Path

# Add Nano Banana to path
sys.path.insert(0, '/Users/lance/lance-claude/09-СПРАВОЧНИКИ/my-promts/claude/claude-artifacts/lesson-modules/3-nano-banana')

from image_gen import generate, new_session
from PIL import Image

# Gemini API key
API_KEY = "AIzaSyCczsgGQ_9AtGxfIP8BKyvAEZ-AwdUw5kM"
os.environ["GEMINI_API_KEY"] = API_KEY

# Paths
BASE_DIR = Path(__file__).parent.parent
OUTPUT_DIR = BASE_DIR / "app" / "outputs"
COVER_PATH = "/Users/lance/lance-claude/09-СПРАВОЧНИКИ/my-promts/claude/claude-artifacts/lesson-modules/3-nano-banana/outputs/skoraya_clean/cover.png"

OUTPUT_DIR.mkdir(exist_ok=True)

app = Flask(__name__, static_folder='.')
CORS(app)


# =============================================
# TROPE PROMPTS
# =============================================
TROPE_PROMPTS = {
    'A4': """Dark atmospheric forest background with misty trees.
        Moody, mysterious. Deep blues and blacks with subtle red glow at bottom.
        Leave LEFT SIDE (40% width) empty for text quote.
        Place 3D book "СКОРАЯ" in BOTTOM-RIGHT corner, small (20% of width).
        The book has red cover with white ambulance cross.
        No text, no UI elements. Format: 1080x1350 (4:5 aspect ratio)""",

    'B1': """Dark gradient background for book marketing slide.
        Smooth vertical gradient from dark gray #2a2a2a at top to almost black #1a1a1a at bottom.
        Subtle noise texture for depth.
        Leave TOP-LEFT area (60% width, 65% height) completely EMPTY for text overlay.
        Place 3D book in BOTTOM-RIGHT corner (position: right 5%, bottom 5%, size 25% of width).
        The book has red cover with white ambulance cross.
        Clean, professional. No text, no UI. Format: 1080x1350 (4:5)""",

    'C1': """Atmospheric dark background with abstract ethereal shapes.
        Deep blue-black tones with subtle golden light rays from above.
        CENTER of image should be mostly clear for text overlay.
        Place 3D book at BOTTOM CENTER, medium size (30% of height).
        The book has red cover with white ambulance cross.
        Cinematic, philosophical mood. No text. Format: 1080x1350 (4:5)""",

    'C3': """Dramatic dark background with visual duality theme.
        Split atmosphere - darker mysterious left side, subtle warm red glow on right.
        Leave CENTER area clear for text (3 short lines).
        Place 3D book in BOTTOM CENTER area.
        The book has red cover with white ambulance cross.
        Tense, conflicted atmosphere. No text. Format: 1080x1350 (4:5)""",

    'E1': """Elegant dark background for author biography slide.
        Subtle gradient from dark charcoal to black.
        Professional, sophisticated feel.
        Leave TOP 60% of image mostly empty for circular photo placeholder and text.
        Place 3D book in BOTTOM-RIGHT corner, small (20% width).
        The book has red cover with white ambulance cross.
        No text, no UI. Format: 1080x1350 (4:5)""",

    'G1': """Dramatic spotlight background for call-to-action slide.
        Very dark base (#0a0a15) with warm red/crimson spotlight effect from below.
        The spotlight should illuminate the CENTER area where book will be.
        Place 3D book prominently in CENTER, large (40% of image height).
        The book has red cover with white ambulance cross, should appear glowing.
        Dramatic, urgent lighting. Leave space at bottom for button.
        No text, no UI elements. Format: 1080x1350 (4:5)""",

    'default': """Dark professional gradient background for book marketing.
        Smooth gradient from #2a2a2a to #1a1a1a.
        Place 3D book in bottom-right corner.
        The book has red cover with white ambulance cross.
        Clean, minimal. No text. Format: 1080x1350 (4:5)"""
}


@app.route('/')
def index():
    """Serve the main app."""
    return send_file('carousel-builder.html')


@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files."""
    return send_from_directory('.', filename)


@app.route('/outputs/<path:filename>')
def serve_output(filename):
    """Serve generated images."""
    return send_from_directory(OUTPUT_DIR, filename)


@app.route('/api/generate', methods=['POST'])
def generate_background():
    """Generate a single background image."""
    data = request.json
    trope_id = data.get('tropeId', 'default')
    slide_index = data.get('slideIndex', 0)

    print(f"\n{'='*50}")
    print(f"Generating background for slide {slide_index + 1} (trope: {trope_id})")
    print(f"{'='*50}")

    # Get prompt for this trope
    prompt = TROPE_PROMPTS.get(trope_id, TROPE_PROMPTS['default'])

    # Reset session for clean generation
    new_session()

    try:
        # Generate with Gemini
        result_path = generate(
            prompt=prompt,
            reference_images=[COVER_PATH],
            aspect_ratio="4:5",
            model="gemini-3-pro-image-preview"
        )

        if result_path:
            # Save to outputs folder
            output_filename = f"slide_{slide_index + 1}_{trope_id}.png"
            output_path = OUTPUT_DIR / output_filename

            img = Image.open(result_path)
            img.save(output_path)

            print(f"Saved to: {output_path}")

            return jsonify({
                'success': True,
                'imageUrl': f'/outputs/{output_filename}',
                'tropeId': trope_id,
                'slideIndex': slide_index
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Generation failed'
            }), 500

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/generate-all', methods=['POST'])
def generate_all():
    """Generate all backgrounds (batch endpoint)."""
    data = request.json
    tropes = data.get('tropes', [])

    results = []
    for i, trope_id in enumerate(tropes):
        print(f"\nProcessing {i + 1}/{len(tropes)}: {trope_id}")

        prompt = TROPE_PROMPTS.get(trope_id, TROPE_PROMPTS['default'])
        new_session()

        try:
            result_path = generate(
                prompt=prompt,
                reference_images=[COVER_PATH],
                aspect_ratio="4:5",
                model="gemini-3-pro-image-preview"
            )

            if result_path:
                output_filename = f"slide_{i + 1}_{trope_id}.png"
                output_path = OUTPUT_DIR / output_filename

                img = Image.open(result_path)
                img.save(output_path)

                results.append({
                    'success': True,
                    'imageUrl': f'/outputs/{output_filename}',
                    'tropeId': trope_id,
                    'slideIndex': i
                })
            else:
                results.append({
                    'success': False,
                    'tropeId': trope_id,
                    'slideIndex': i,
                    'error': 'Generation failed'
                })

        except Exception as e:
            results.append({
                'success': False,
                'tropeId': trope_id,
                'slideIndex': i,
                'error': str(e)
            })

    return jsonify({
        'results': results,
        'total': len(tropes),
        'successful': sum(1 for r in results if r['success'])
    })


if __name__ == '__main__':
    print("="*60)
    print("CAROUSEL GENERATOR SERVER")
    print("="*60)
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Cover reference: {COVER_PATH}")
    print()
    print("Starting server at http://localhost:5050")
    print("Open http://localhost:5050 in browser")
    print("="*60)

    app.run(host='0.0.0.0', port=5050, debug=True)
