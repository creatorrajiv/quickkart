/**
 * Sound — tiny in-app sound effect player.
 * ──────────────────────────────────────────────────────────────────────────
 * Uses the Web Audio API to synthesise short notification chimes so we
 * don't need to ship audio assets. Different "tones" for different events.
 *
 *   import { playSound } from '@/lib/sound';
 *   playSound('notification');   // soft chime
 *   playSound('order');          // pleasing two-note for new orders
 *   playSound('success');        // bright ding
 *   playSound('error');          // low descending pair
 *
 * Browsers block audio until the user interacts with the page. Calling
 * playSound() before that first interaction is a no-op (silent), it
 * doesn't throw. Once the user clicks once, audio works.
 */

let audioCtx = null;
let enabled  = true;

function getCtx() {
  if (audioCtx) return audioCtx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  } catch {
    return null;
  }
}

const TONES = {
  notification: [{ freq: 880, dur: 0.12 }, { freq: 1318, dur: 0.18 }],
  order:        [{ freq: 660, dur: 0.10 }, { freq: 880, dur: 0.10 }, { freq: 1175, dur: 0.18 }],
  success:      [{ freq: 988, dur: 0.10 }, { freq: 1318, dur: 0.20 }],
  error:        [{ freq: 220, dur: 0.12 }, { freq: 165, dur: 0.16 }],
  click:        [{ freq: 1500, dur: 0.04 }],
};

export function setSoundEnabled(value) { enabled = !!value; }
export function isSoundEnabled() { return enabled; }

export function playSound(kind = 'notification', { volume = 0.18 } = {}) {
  if (!enabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  // If the user hasn't interacted yet, the context is in "suspended" state.
  // We try resume() but don't await — if it stays suspended we just don't play.
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
    if (ctx.state === 'suspended') return;
  }

  const sequence = TONES[kind] ?? TONES.notification;
  let t = ctx.currentTime;
  for (const note of sequence) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(note.freq, t);
    // Brief attack & decay to avoid clicks
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + note.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + note.dur + 0.02);
    t += note.dur;
  }
}
