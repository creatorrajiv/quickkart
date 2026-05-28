/**
 * Customer CartPage — v2 redesign
 * ──────────────────────────────────────────────────────────────────────────
 * Flow stays identical: empty → review → success.
 * Visual changes:
 *   • Brand-gradient header with back arrow + title
 *   • AddressPicker (saved addresses + add new) replaces inline AddressForm
 *   • Cleaner section spacing
 *   • Sticky bottom "Place Order" bar with brand gradient
 *   • Confetti-ish success screen with subtle animation
 *   • Toast + sound on order placed
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate }                  from 'react-router-dom';

import { useCart }                      from '../../context/CartProvider';
import { useAuth }                      from '../../context/AuthContext';
import { placeOrder }                   from '../../services/ordersService';
import { calculateOrderTotals,
         PAYMENT_METHODS,
         formatPrice,
         getDeliveryETA }               from '../../config/business';
import { notify }                       from '../../lib/notify';
import { openWhatsAppOrder, isWhatsAppShareEnabled } from '../../lib/whatsapp';
import { validateCoupon }               from '../../services/couponsService';
import { Input } from '../../ui';

import {
  CartLineItem,
  AddressPicker,
  OrderSummary,
  PaymentSelector,
  DeliverySlotPicker,
} from '../../components/customer';
import { Button } from '../../ui';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, count, subtotal, updateQuantity, removeItem, clearCart } = useCart();
  const { session, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  const [address,       setAddress]       = useState('');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS.COD);
  const [placing,       setPlacing]       = useState(false);
  const [placeError,    setPlaceError]    = useState(null);
  const [placedOrderId, setPlacedOrderId] = useState(null);

  // Coupon state
  const [couponInput,   setCouponInput]   = useState('');
  const [couponApplied, setCouponApplied] = useState(null); // { code, discount_amount, message }
  const [couponBusy,    setCouponBusy]    = useState(false);

  // Delivery slot
  const [slot, setSlot] = useState({ value: null, label: 'ASAP' });

  const totalsBefore = useMemo(() => calculateOrderTotals(subtotal), [subtotal]);
  const discount     = couponApplied?.discount_amount ?? 0;
  const totals       = useMemo(() => ({
    ...totalsBefore,
    discount,
    total: Math.max(0, Math.round((totalsBefore.total - discount) * 100) / 100),
  }), [totalsBefore, discount]);

  const handleApplyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponBusy(true);
    const result = await validateCoupon(code, subtotal);
    setCouponBusy(false);
    if (!result.valid) {
      notify.error('Coupon not applied', result.message);
      return;
    }
    setCouponApplied(result);
    notify.success(`${result.code} applied`, `You saved ${formatPrice(result.discount_amount)}!`);
  };

  const handleRemoveCoupon = () => {
    setCouponApplied(null);
    setCouponInput('');
  };

  const handlePlaceOrder = async () => {
    if (placing) return;
    if (!address.trim()) {
      setPlaceError('Pick or add a delivery address before placing the order.');
      notify.error('Address missing', 'Please select an address.');
      return;
    }

    setPlacing(true); setPlaceError(null);
    const { orderId, error } = await placeOrder({
      items, paymentMethod, deliveryAddress: address,
      couponCode: couponApplied?.code ?? null,
      deliverySlot:      slot.value,
      deliverySlotLabel: slot.label,
    });
    if (error) {
      setPlaceError(error.message ?? 'Could not place order.');
      notify.error('Order failed', error.message);
      setPlacing(false);
      return;
    }
    clearCart();
    setPlacedOrderId(orderId);
    setPlacing(false);
    notify.success('Order placed!', 'Track it from My Orders.');
  };

  if (placedOrderId) {
    return (
      <SuccessScreen
        orderId={placedOrderId}
        onContinueShopping={() => navigate('/shop')}
        onTrackOrder={() => navigate(`/orders/${placedOrderId}`)}
      />
    );
  }

  if (count === 0) return <EmptyCart onShop={() => navigate('/shop')} />;

  return (
    <div className="min-h-screen bg-ink-50 pb-36">

      {/* Brand header */}
      <header className="bg-brand-gradient text-white px-4 py-5 sm:px-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="mx-auto max-w-3xl flex items-center gap-3 relative">
          <button
            onClick={() => navigate('/shop')}
            className="rounded-full p-2 bg-white/15 hover:bg-white/25 active:scale-95 transition-all"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="font-display text-xl font-bold leading-tight">Your Cart</h1>
            <p className="text-xs text-white/85">{count} item{count === 1 ? '' : 's'} · {formatPrice(totals.total)} to pay</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-5 sm:px-6 -mt-3">

        <section className="space-y-2.5">
          {items.map(item => (
            <CartLineItem
              key={item.productId}
              item={item}
              onIncrement={() => updateQuantity(item.productId, item.quantity + 1)}
              onDecrement={() => updateQuantity(item.productId, item.quantity - 1)}
              onRemove={()    => removeItem(item.productId)}
            />
          ))}
        </section>

        {profile && (
          <AddressPicker userId={profile.id} value={address} onChange={setAddress} />
        )}

        <DeliverySlotPicker value={slot.value} onChange={setSlot} />

        <PaymentSelector value={paymentMethod} onChange={setPaymentMethod} />

        {/* Coupon block */}
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h3 className="font-display text-base font-bold text-ink-900 mb-3">Promo code</h3>
          {couponApplied ? (
            <div className="rounded-xl bg-gradient-to-br from-green-50 to-accent-50 border border-green-200 p-3 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm">🎟️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-green-800">{couponApplied.code} applied</p>
                <p className="text-xs text-green-700">You saved {formatPrice(couponApplied.discount_amount)}</p>
              </div>
              <button onClick={handleRemoveCoupon}
                className="text-xs font-bold text-red-600 hover:underline">
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={couponInput}
                onChange={e => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Enter code (e.g. WELCOME50)"
                className="flex-1 uppercase"
              />
              <button
                onClick={handleApplyCoupon}
                disabled={couponBusy || !couponInput.trim()}
                className="rounded-xl bg-brand-500 text-white font-bold px-4 hover:bg-brand-600 active:scale-95 disabled:opacity-60 transition-all"
              >
                {couponBusy ? '…' : 'Apply'}
              </button>
            </div>
          )}
        </section>

        <OrderSummary totals={totals} itemCount={count} />

        {placeError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {placeError}
          </div>
        )}

        {/* WhatsApp share — only shown if business number is configured */}
        {isWhatsAppShareEnabled() && (
          <button
            type="button"
            onClick={() => {
              const ok = openWhatsAppOrder({
                items, totals,
                deliveryAddress: address,
                paymentMethod,
                profile,
              });
              if (ok) notify.success('Opening WhatsApp…', 'Send the message to confirm your order.');
            }}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] hover:bg-[#1ebe57] active:scale-[0.98]
              text-white font-bold py-3.5 px-5 shadow-pop transition-all"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.264 8.264 0 01-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42 1.56 1.56 2.42 3.63 2.42 5.83-.01 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.57.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
            </svg>
            Order on WhatsApp instead
          </button>
        )}
      </main>

      {/* Sticky Place Order bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-white border-t border-ink-100 px-4 py-3 sm:px-6 shadow-pop">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-wide text-ink-500 font-medium">Total</p>
            <p className="font-display text-xl font-extrabold text-ink-900">{formatPrice(totals.total)}</p>
          </div>
          <Button
            onClick={handlePlaceOrder}
            loading={placing}
            disabled={count === 0}
            size="lg"
            className="flex-1 max-w-xs"
            rightIcon={
              !placing && (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )
            }
          >
            {placing ? 'Placing…' : 'Place Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-views ─────────────────────────────────────────────────────────────
function EmptyCart({ onShop }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-50 to-accent-50 text-5xl shadow-sm">
        🛒
      </div>
      <h1 className="font-display text-2xl font-bold text-ink-900 mt-5">Your cart is empty</h1>
      <p className="mt-2 text-sm text-ink-500 max-w-xs">Add some delicious finds from our storefront to get started.</p>
      <Button onClick={onShop} size="lg" className="mt-6">
        Browse products
      </Button>
    </div>
  );
}

function SuccessScreen({ orderId, onContinueShopping, onTrackOrder }) {
  const shortId = orderId?.split('-')[0] ?? '';
  const eta = getDeliveryETA('placed');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-6 text-center relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-brand-100 blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-pop animate-bounce-once">
          <svg className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="font-display text-3xl font-extrabold text-ink-900 mt-6">Order placed!</h1>
        <p className="mt-2 text-sm text-ink-600">
          Order <span className="font-mono font-bold text-ink-900">#{shortId}</span> is being prepared.
        </p>
        {eta && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-brand-50 to-accent-50 border border-brand-100 px-4 py-2.5">
            <span className="text-xl">🛵</span>
            <div className="text-left">
              <p className="text-[10px] uppercase tracking-wider font-bold text-ink-500">Arriving in</p>
              <p className="font-display text-base font-extrabold text-brand-600 leading-tight">{eta.label}</p>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-500">You'll get notifications when it's on its way.</p>

        <div className="mt-7 flex flex-col gap-2 w-full max-w-xs mx-auto">
          <Button onClick={onTrackOrder} size="lg" fullWidth>Track Order</Button>
          <Button onClick={onContinueShopping} variant="outline" size="lg" fullWidth>Continue Shopping</Button>
        </div>
      </div>
    </div>
  );
}
