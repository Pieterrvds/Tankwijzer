/**
 * Audio recording helpers around MediaRecorder.
 *
 * iOS Safari records audio/mp4 (AAC), Android Chrome audio/webm (Opus). We pick the first
 * supported type and keep it with the blob, so the export can use the right extension.
 */
const PREFERRED_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];

export function pickAudioMimeType(
  isSupported: (type: string) => boolean = (t) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t),
): string | undefined {
  return PREFERRED_TYPES.find(isSupported);
}

/** File extension for an audio MIME type: audio/mp4 → m4a, audio/webm;codecs=opus → webm. */
export function audioExtension(mimeType: string): string {
  const base = mimeType.split(';')[0]?.trim() ?? '';
  if (base === 'audio/mp4' || base === 'audio/aac') return 'm4a';
  if (base === 'audio/webm') return 'webm';
  if (base === 'audio/ogg') return 'ogg';
  return 'audio';
}

export function isAudioRecordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}
