import { describe, expect, it } from 'vitest';
import { audioExtension, formatDuration, pickAudioMimeType } from './audio';
import { fitWithin } from './photo';

describe('fitWithin', () => {
  it('downscales the long side to 2000 px, keeping the aspect ratio', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1500, height: 2000 });
  });

  it('never upscales small images', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe('audio helpers', () => {
  it('prefers mp4 (iOS) and falls back to webm (Android)', () => {
    expect(pickAudioMimeType(() => true)).toBe('audio/mp4');
    expect(pickAudioMimeType((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickAudioMimeType(() => false)).toBeUndefined();
  });

  it('maps MIME types to file extensions', () => {
    expect(audioExtension('audio/mp4')).toBe('m4a');
    expect(audioExtension('audio/webm;codecs=opus')).toBe('webm');
  });

  it('formats durations as m:ss', () => {
    expect(formatDuration(65_000)).toBe('1:05');
  });
});
