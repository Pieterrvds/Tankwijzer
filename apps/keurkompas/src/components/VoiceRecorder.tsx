import { useEffect, useRef, useState } from 'react';
import { formatDuration, isAudioRecordingSupported, pickAudioMimeType } from '../capture/audio';
import { kickQueue } from '../ai/queue';
import { repo } from '../db/repository';
import { kickSync } from '../sync/sync';

/** Recordings shorter than this are treated as an accidental tap. */
const MIN_DURATION_MS = 700;

interface Props {
  inspectionId: string;
  className?: string;
}

/**
 * Hold-to-record button (walkie-talkie style): press and hold to record, release to save.
 * Audio is stored offline in IndexedDB; transcription happens later, when online (M4).
 */
export function VoiceRecordButton({ inspectionId, className = '' }: Props) {
  const [state, setState] = useState<'idle' | 'starting' | 'recording'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const released = useRef(true);
  const startedAt = useRef(0);

  useEffect(() => {
    if (state !== 'recording') return;
    const t = setInterval(() => setElapsed(Date.now() - startedAt.current), 250);
    return () => clearInterval(t);
  }, [state]);

  // Short-lived message above the capture bar.
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  // Stop a running recording if the component disappears (e.g. navigation).
  useEffect(() => () => recorder.current?.stop(), []);

  if (!isAudioRecordingSupported()) {
    return (
      <p className={`text-sm text-gray-600 ${className}`}>
        Spraakopname niet beschikbaar op dit toestel.
      </p>
    );
  }

  async function start() {
    setMessage(null);
    setState('starting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState('idle');
      setMessage('Geen toegang tot de microfoon. Sta dit toe in de instellingen van de browser.');
      return;
    }
    // The permission dialog may have "eaten" the press: then don't start recording.
    if (released.current) {
      stream.getTracks().forEach((t) => t.stop());
      setState('idle');
      setMessage('Microfoon klaar. Houd de knop ingedrukt om op te nemen.');
      return;
    }

    const mimeType = pickAudioMimeType();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      recorder.current = null;
      setState('idle');
      const durationMs = Date.now() - startedAt.current;
      if (durationMs < MIN_DURATION_MS) {
        setMessage('Te kort. Houd de knop ingedrukt zolang je spreekt.');
        return;
      }
      const type = rec.mimeType || mimeType || 'audio/webm';
      void repo
        .addVoiceNote({
          inspectionId,
          blob: new Blob(chunks, { type }),
          mimeType: type,
          durationMs,
        })
        .then((note) => {
          setMessage(`${note.label} bewaard (${formatDuration(durationMs)}).`);
          kickSync();
          void kickQueue();
        });
    };
    recorder.current = rec;
    startedAt.current = Date.now();
    setElapsed(0);
    rec.start(1000);
    navigator.vibrate?.(40);
    setState('recording');
  }

  function stop() {
    released.current = true;
    if (recorder.current?.state === 'recording') {
      navigator.vibrate?.(20);
      recorder.current.stop();
    }
  }

  const recording = state === 'recording';
  return (
    <div className={className}>
      <button
        type="button"
        className={`no-callout flex min-h-16 w-full flex-col items-center justify-center rounded-xl px-2 font-semibold ${
          recording
            ? 'animate-pulse bg-nok text-white'
            : 'bg-brand text-white active:bg-brand-light'
        }`}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          released.current = false;
          if (state === 'idle') void start();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Houd ingedrukt om een spraaknotitie op te nemen"
      >
        <span className="text-2xl" aria-hidden>
          🎤
        </span>
        <span className="text-sm">
          {recording
            ? `Opname ${formatDuration(elapsed)}`
            : state === 'starting'
              ? 'Microfoon…'
              : 'Houd in: spraak'}
        </span>
      </button>
      {message && (
        <p className="absolute right-4 bottom-full left-4 mb-2 rounded-lg bg-gray-950 p-2 text-center text-sm text-white">
          {message}
        </p>
      )}
    </div>
  );
}
