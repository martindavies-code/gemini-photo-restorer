import { describe, it, expect } from 'vitest';
import { calculateTargetDimensions, MAX_CANVAS_DIMENSION } from './upscaleCanvasService';

describe('Upscale Canvas Service - Target Dimension Calculations', () => {
  it('returns native dimensions for native target scale', () => {
    const result = calculateTargetDimensions(1200, 800, 'native');
    expect(result.width).toBe(1200);
    expect(result.height).toBe(800);
    expect(result.scaleLabel).toBe('Native AI Output');
  });

  it('doubles dimensions for 2x target scale', () => {
    const result = calculateTargetDimensions(1000, 750, '2x');
    expect(result.width).toBe(2000);
    expect(result.height).toBe(1500);
    expect(result.scaleLabel).toBe('2X Enhanced');
  });

  it('calculates landscape 4K Ultra HD target dimensions accurately (16:9)', () => {
    const result = calculateTargetDimensions(1920, 1080, '4k');
    expect(result.width).toBe(3840);
    expect(result.height).toBe(2160);
    expect(result.scaleLabel).toBe('4K Ultra HD');
  });

  it('calculates portrait 4K target dimensions accurately (9:16)', () => {
    const result = calculateTargetDimensions(1080, 1920, '4k');
    expect(result.width).toBe(2160);
    expect(result.height).toBe(3840);
  });

  it('calculates landscape 8K Gallery Master target dimensions accurately (16:9)', () => {
    const result = calculateTargetDimensions(1920, 1080, '8k');
    expect(result.width).toBe(7680);
    expect(result.height).toBe(4320);
    expect(result.scaleLabel).toBe('8K Gallery Master');
  });

  it('calculates portrait 8K target dimensions accurately (9:16)', () => {
    const result = calculateTargetDimensions(1080, 1920, '8k');
    expect(result.width).toBe(4320);
    expect(result.height).toBe(7680);
  });

  it('caps dimensions exceeding MAX_CANVAS_DIMENSION to prevent browser crash', () => {
    const result = calculateTargetDimensions(6000, 6000, '2x');
    expect(result.width).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION);
    expect(result.height).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION);
  });

  it('handles division by zero and invalid dimensions gracefully without throwing', () => {
    // 0x0
    const zeroResult = calculateTargetDimensions(0, 0, '4k');
    expect(Number.isFinite(zeroResult.width)).toBe(true);
    expect(Number.isFinite(zeroResult.height)).toBe(true);
    expect(zeroResult.width).toBeGreaterThan(0);
    expect(zeroResult.height).toBeGreaterThan(0);

    // Negative dimensions
    const negativeResult = calculateTargetDimensions(-1920, -1080, '8k');
    expect(negativeResult.width).toBeGreaterThan(0);
    expect(negativeResult.height).toBeGreaterThan(0);

    // NaN / Infinity inputs
    const nanResult = calculateTargetDimensions(NaN, NaN, 'native');
    expect(Number.isFinite(nanResult.width)).toBe(true);
    expect(nanResult.width).toBeGreaterThan(0);
  });

  it('handles extreme panoramic and tall aspect ratios safely', () => {
    const ultraWide = calculateTargetDimensions(5000, 100, '4k');
    expect(ultraWide.width).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION);
    expect(ultraWide.height).toBeGreaterThanOrEqual(1);

    const ultraTall = calculateTargetDimensions(100, 5000, '8k');
    expect(ultraTall.height).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION);
    expect(ultraTall.width).toBeGreaterThanOrEqual(1);
  });
});
