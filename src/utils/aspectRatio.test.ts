import { describe, it, expect } from 'vitest';
import {
  findClosestGeminiAspectRatio,
  formatAspectRatio,
  GEMINI_SUPPORTED_ASPECT_RATIOS
} from './aspectRatio';

describe('Aspect Ratio Preservation Engine', () => {
  it('correctly matches standard aspect ratios to Gemini discrete buckets', () => {
    // 1:1 Square
    expect(findClosestGeminiAspectRatio(1000, 1000)).toBe('1:1');
    expect(findClosestGeminiAspectRatio(512, 512)).toBe('1:1');

    // 16:9 Landscape
    expect(findClosestGeminiAspectRatio(1920, 1080)).toBe('16:9');
    expect(findClosestGeminiAspectRatio(1280, 720)).toBe('16:9');
    expect(findClosestGeminiAspectRatio(3840, 2160)).toBe('16:9');

    // 9:16 Portrait
    expect(findClosestGeminiAspectRatio(1080, 1920)).toBe('9:16');

    // 3:2 Photography format (35mm / DSLR)
    expect(findClosestGeminiAspectRatio(3000, 2000)).toBe('3:2');
    expect(findClosestGeminiAspectRatio(6000, 4000)).toBe('3:2');

    // 2:3 Vertical portrait
    expect(findClosestGeminiAspectRatio(2000, 3000)).toBe('2:3');

    // 4:3 Classical digital / monitor
    expect(findClosestGeminiAspectRatio(1600, 1200)).toBe('4:3');

    // 3:4 Vertical classical
    expect(findClosestGeminiAspectRatio(1200, 1600)).toBe('3:4');

    // 21:9 Ultrawide cinema
    expect(findClosestGeminiAspectRatio(2560, 1080)).toBe('21:9');
    expect(findClosestGeminiAspectRatio(3440, 1440)).toBe('21:9');

    // Extreme panos
    expect(findClosestGeminiAspectRatio(4000, 1000)).toBe('4:1');
    expect(findClosestGeminiAspectRatio(8000, 1000)).toBe('8:1');
    expect(findClosestGeminiAspectRatio(1000, 4000)).toBe('1:4');
    expect(findClosestGeminiAspectRatio(1000, 8000)).toBe('1:8');
  });

  it('selects the scale-invariant nearest ratio for non-standard image dimensions', () => {
    // 1366x768 (1.7786 -> 16:9 is 1.7778)
    expect(findClosestGeminiAspectRatio(1366, 768)).toBe('16:9');

    // 1000x700 (1.428 -> between 4:3=1.333 and 3:2=1.500; ln(1.428) is closer to ln(1.5))
    expect(findClosestGeminiAspectRatio(1000, 700)).toBe('3:2');

    // 1000x780 (1.282 -> closer to 5:4=1.25)
    expect(findClosestGeminiAspectRatio(1000, 780)).toBe('5:4');

    // 500x600 (0.833 -> closer to 4:5=0.800)
    expect(findClosestGeminiAspectRatio(500, 600)).toBe('4:5');
  });

  it('handles edge cases safely with division-by-zero guards', () => {
    expect(findClosestGeminiAspectRatio(0, 0)).toBe('1:1');
    expect(findClosestGeminiAspectRatio(-100, 500)).toBe('1:1');
    expect(findClosestGeminiAspectRatio(100, 0)).toBe('1:1');
    expect(findClosestGeminiAspectRatio(NaN, 100)).toBe('1:1');
    expect(findClosestGeminiAspectRatio(Infinity, 100)).toBe('1:1');
  });

  it('formats aspect ratio labels accurately', () => {
    expect(formatAspectRatio(1920, 1080)).toBe('1.78:1');
    expect(formatAspectRatio(1000, 1000)).toBe('1.00:1');
    expect(formatAspectRatio(0, 0)).toBe('1:1');
  });

  it('contains exactly the 14 Gemini API documented aspect ratios', () => {
    expect(GEMINI_SUPPORTED_ASPECT_RATIOS.length).toBe(14);
    const labels = GEMINI_SUPPORTED_ASPECT_RATIOS.map((item) => item.label);
    expect(labels).toContain('1:1');
    expect(labels).toContain('4:3');
    expect(labels).toContain('3:4');
    expect(labels).toContain('3:2');
    expect(labels).toContain('2:3');
    expect(labels).toContain('16:9');
    expect(labels).toContain('9:16');
    expect(labels).toContain('5:4');
    expect(labels).toContain('4:5');
    expect(labels).toContain('21:9');
    expect(labels).toContain('4:1');
    expect(labels).toContain('1:4');
    expect(labels).toContain('8:1');
    expect(labels).toContain('1:8');
  });
});
