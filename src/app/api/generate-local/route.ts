import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

// Path to Nano Banana module
const NANO_BANANA_DIR = '/Users/lance/lance-claude/09-СПРАВОЧНИКИ/my-promts/claude/claude-artifacts/lesson-modules/3-nano-banana';

// Trope prompts for different slide types
const TROPE_PROMPTS: Record<string, string> = {
  'hook': `Dark atmospheric background for book marketing slide.
Deep moody tones with subtle red accents.
Leave LEFT SIDE (40% width) empty for text overlay.
Place 3D book in BOTTOM-RIGHT corner, small (20% of width).
The book should match the reference cover image.
Clean, professional. No text, no UI. Format: 1080x1350 (4:5)`,

  'audience': `Dark gradient background for book marketing slide.
Smooth vertical gradient from dark gray #2a2a2a at top to almost black #1a1a1a at bottom.
Leave TOP-LEFT area (60% width, 65% height) completely EMPTY for text overlay.
Place 3D book in BOTTOM-RIGHT corner (25% of width).
The book should match the reference cover image.
Clean, minimal. No text, no UI. Format: 1080x1350 (4:5)`,

  'about': `Atmospheric dark background with abstract ethereal shapes.
Deep blue-black tones with subtle light rays.
CENTER should be mostly clear for text overlay.
Place 3D book at BOTTOM CENTER, medium size (30% of height).
The book should match the reference cover image.
Cinematic mood. No text. Format: 1080x1350 (4:5)`,

  'author': `Elegant dark background for author biography slide.
Subtle gradient from dark charcoal to black.
Professional, sophisticated feel.
Leave TOP 60% mostly empty for photo placeholder and text.
Place 3D book in BOTTOM-RIGHT corner, small (20% width).
The book should match the reference cover image.
No text, no UI. Format: 1080x1350 (4:5)`,

  'specs': `Clean dark background for book specifications.
Minimal gradient from #2a2a2a to #1a1a1a.
Leave LEFT SIDE (50% width) empty for specs list.
Place 3D book in RIGHT SIDE, medium size.
The book should match the reference cover image.
Professional, clean. No text. Format: 1080x1350 (4:5)`,

  'cta': `Dramatic spotlight background for call-to-action slide.
Very dark base (#0a0a15) with warm red/crimson spotlight from below.
The spotlight should illuminate the CENTER area.
Place 3D book prominently in CENTER, large (40% of image height).
The book should match the reference cover image and appear glowing.
Dramatic, urgent lighting. Leave space at bottom for button.
No text, no UI. Format: 1080x1350 (4:5)`,

  'default': `Dark professional gradient background for book marketing.
Smooth gradient from #2a2a2a to #1a1a1a.
Place 3D book in bottom-right corner.
The book should match the reference cover image.
Clean, minimal. No text. Format: 1080x1350 (4:5)`
};

export async function POST(request: NextRequest) {
  try {
    const { slideType, coverData } = await request.json();

    if (!coverData) {
      return NextResponse.json(
        { error: 'Missing coverData' },
        { status: 400 }
      );
    }

    // Get prompt for slide type
    const prompt = TROPE_PROMPTS[slideType] || TROPE_PROMPTS['default'];

    // Save cover to temp file
    const coverBuffer = Buffer.from(coverData, 'base64');
    const tempCoverPath = path.join(tmpdir(), `cover_${Date.now()}.png`);
    await writeFile(tempCoverPath, coverBuffer);

    // Python script to generate image
    const pythonScript = `
import sys
sys.path.insert(0, '${NANO_BANANA_DIR}')

from image_gen import generate, new_session
import os

os.environ['GEMINI_API_KEY'] = '${process.env.GEMINI_API_KEY}'

new_session()

prompt = """${prompt.replace(/"/g, '\\"')}"""

result = generate(
    prompt=prompt,
    reference_images=['${tempCoverPath}'],
    aspect_ratio='4:5',
    model='gemini-3-pro-image-preview'
)

print(result)
`;

    // Execute Python script
    const { stdout, stderr } = await execAsync(
      `cd ${NANO_BANANA_DIR} && python3 -c "${pythonScript.replace(/"/g, '\\"')}"`,
      { maxBuffer: 10 * 1024 * 1024 }
    );

    if (stderr && !stderr.includes('Session cleared')) {
      console.error('Python stderr:', stderr);
    }

    // Extract output path
    const outputPath = stdout.trim().split('\n').pop()?.trim();

    if (!outputPath || !outputPath.startsWith('outputs/')) {
      throw new Error('Failed to get output path');
    }

    // Read generated image
    const fullOutputPath = path.join(NANO_BANANA_DIR, outputPath);
    const imageBuffer = await readFile(fullOutputPath);
    const imageBase64 = imageBuffer.toString('base64');

    // Cleanup temp cover
    await unlink(tempCoverPath);

    return NextResponse.json({
      success: true,
      imageData: imageBase64,
      slideType
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
