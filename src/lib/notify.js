/**
 * notify — thin wrapper around sonner toasts + sound effects.
 * ──────────────────────────────────────────────────────────────────────────
 *   import { notify } from '@/lib/notify';
 *
 *   notify.success('Order placed!');
 *   notify.error('Could not save', err.message);
 *   notify.info('Out for delivery');
 *   notify('New order #1234 received', { sound: 'order' });
 *
 * Each helper:
 *   • shows a toast
 *   • plays a synthesised sound (no asset needed; see lib/sound.js)
 *   • is safe to call before user interaction (silently no-op on sound)
 */

import { toast } from 'sonner';
import { playSound } from './sound';

function base(message, opts = {}) {
  if (opts.sound !== false) playSound(opts.sound ?? 'notification');
  return toast(message, opts);
}

base.success = (message, description, opts = {}) => {
  playSound(opts.sound ?? 'success');
  return toast.success(message, { description, ...opts });
};

base.error = (message, description, opts = {}) => {
  playSound(opts.sound ?? 'error');
  return toast.error(message, { description, ...opts });
};

base.info = (message, description, opts = {}) => {
  playSound(opts.sound ?? 'notification');
  return toast.info(message, { description, ...opts });
};

base.warning = (message, description, opts = {}) => {
  playSound(opts.sound ?? 'notification');
  return toast.warning(message, { description, ...opts });
};

base.message = (message, opts = {}) => toast(message, opts);

base.dismiss = (id) => toast.dismiss(id);

export const notify = base;
export default base;
