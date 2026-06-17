/**
 * CAPTCHA OCR — Tesseract(워크스페이스 경로) + LM Studio vision fallback
 */

import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const OCR_DIR = join(process.cwd(), 'outputs', 'captcha-ocr');

function scaleCaptchaImage(sourcePath: string): string {
  mkdirSync(OCR_DIR, { recursive: true });
  const localPath = join(OCR_DIR, `captcha_${Date.now()}.png`);
  copyFileSync(sourcePath, localPath);

  const scaledPath = join(OCR_DIR, 'scaled.png');
  try {
    execSync(`sips -z 105 210 "${localPath}" --out "${scaledPath}"`, { stdio: 'pipe' });
    return scaledPath;
  } catch {
    return localPath;
  }
}

function ocrWithTesseract(imagePath: string): string | null {
  try {
    execSync('which tesseract', { timeout: 2000 });
  } catch {
    return null;
  }

  try {
    const text = execSync(
      `tesseract "${imagePath}" stdout -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 --psm 8 2>/dev/null`,
      { timeout: 10_000 },
    ).toString().trim().replace(/[^A-Za-z0-9]/g, '');

    return text.length >= 3 ? text.slice(0, 4) : null;
  } catch {
    return null;
  }
}

async function ocrWithLmStudio(imagePath: string): Promise<string | null> {
  const endpoint = process.env.LM_STUDIO_VISION_ENDPOINT ?? 'http://localhost:1234/v1/chat/completions';
  const model = process.env.LM_STUDIO_VISION_MODEL ?? 'qwen/qwen3.5-9b';
  const apiKey = process.env.LM_STUDIO_API_KEY ?? 'lm-studio';

  const imageBuffer = readFileSync(imagePath);
  const dataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'CAPTCHA OCR. Output format: CAPTCHA=XXXX (4 alphanumeric chars only)' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
      max_tokens: 256,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) {
    return null;
  }

  const data = await resp.json() as {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
  };
  const message = data.choices?.[0]?.message;
  const combined = `${message?.content ?? ''}\n${message?.reasoning_content ?? ''}`;

  const captchaMatch = combined.match(/CAPTCHA=([A-Za-z0-9]{4})/i);
  if (captchaMatch) {
    return captchaMatch[1].toUpperCase();
  }

  const genericMatch = combined.match(/\b([A-Za-z0-9]{4})\b/);
  return genericMatch ? genericMatch[1].toUpperCase() : null;
}

export async function ocrCaptchaImage(
  imagePath: string,
): Promise<{ success: boolean; text?: string; error?: string }> {
  const scaledPath = scaleCaptchaImage(imagePath);

  try {
    const visionText = await ocrWithLmStudio(scaledPath);
    if (visionText) {
      return { success: true, text: visionText };
    }
  } catch (error) {
    const tesseractText = ocrWithTesseract(scaledPath);
    if (tesseractText) {
      return { success: true, text: tesseractText };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const tesseractText = ocrWithTesseract(scaledPath);
  if (tesseractText) {
    return { success: true, text: tesseractText };
  }

  return {
    success: false,
    error: 'CAPTCHA OCR failed (LM Studio vision + tesseract)',
  };
}
