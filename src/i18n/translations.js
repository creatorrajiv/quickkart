/**
 * Translations dictionary
 * ──────────────────────────────────────────────────────────────────────────
 *  Plain object lookup. To add a string:
 *    1. Add an English key here (en)
 *    2. Add the same key under hi with the Hindi translation
 *    3. Use `t('your.key')` in components
 *
 *  Missing Hindi entries fall back to English automatically.
 *
 *  Conventions:
 *    • Dot.namespaced keys: 'cart.empty.title'
 *    • Interpolation via {name}: t('greeting.hi', { name: 'Priya' })
 */

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi',   native: 'हिंदी' },
];

export const translations = {
  en: {
    // Common buttons / words
    'common.add':         'Add',
    'common.save':        'Save',
    'common.cancel':      'Cancel',
    'common.delete':      'Delete',
    'common.edit':        'Edit',
    'common.back':        'Back',
    'common.continue':    'Continue',
    'common.confirm':     'Confirm',
    'common.loading':     'Loading…',
    'common.search':      'Search',
    'common.signOut':     'Sign out',
    'common.signIn':      'Sign in',
    'common.register':    'Create account',
    'common.profile':     'Profile',
    'common.orders':      'Orders',
    'common.home':        'Home',
    'common.minutes':     'min',

    // Greetings
    'greeting.hi':        'Hi, {name}',
    'greeting.welcome':   'Welcome back',
    'greeting.deliveringTo': 'Delivering to',

    // Storefront
    'shop.searchPlaceholder': 'Search for groceries, meals, eggs…',
    'shop.shopBy':            'Shop by category',
    'shop.whatsInStore':      "What's in store",
    'shop.results':           'Results for "{query}"',
    'shop.itemsCount':        '{count} items',
    'shop.itemCount':         '{count} item',
    'shop.empty.title':       'No products found',
    'shop.empty.noMatch':     'Nothing matches "{query}".',
    'shop.empty.checkBack':   'Check back soon — the catalogue is being updated.',
    'shop.recentSearches':    'Recent searches',
    'shop.clear':             'Clear',

    // Product card
    'product.add':            'ADD',
    'product.outOfStock':     'Out of stock',
    'product.tapToView':      'Tap to view',

    // Categories
    'cat.all':                'All',

    // Cart
    'cart.title':             'Your Cart',
    'cart.empty.title':       'Your cart is empty',
    'cart.empty.subtitle':    'Add some delicious finds from our storefront to get started.',
    'cart.empty.browse':      'Browse products',
    'cart.address':           'Delivery address',
    'cart.addAddress':        'Add new',
    'cart.useLocation':       'Use my current location',
    'cart.locating':          'Finding your location…',
    'cart.payment':           'Payment method',
    'cart.payment.cod':       'Cash on Delivery',
    'cart.payment.online':    'Online Payment',
    'cart.payment.online.sub': 'UPI, cards, wallets — coming soon',
    'cart.payment.cod.sub':   'Pay the delivery agent on arrival',
    'cart.promoCode':         'Promo code',
    'cart.promoApplied':      '{code} applied',
    'cart.promoSaved':        'You saved {amount}',
    'cart.promoEnter':        'Enter code (e.g. WELCOME50)',
    'cart.promoApply':        'Apply',
    'cart.promoRemove':       'Remove',
    'cart.billDetails':       'Bill details',
    'cart.itemTotal':         'Item total',
    'cart.delivery':          'Delivery fee',
    'cart.taxes':             'Taxes & charges',
    'cart.discount':          'Coupon discount',
    'cart.toPay':             'To Pay',
    'cart.free':              'FREE',
    'cart.freeDeliveryHint':  'Add {amount} more for FREE delivery',
    'cart.youSaved':          '🎉 You saved on delivery',
    'cart.placeOrder':        'Place Order',
    'cart.placing':           'Placing…',
    'cart.whatsappOrder':     'Order on WhatsApp instead',

    // Order success
    'order.placed':           'Order placed!',
    'order.preparing':        'Order #{id} is being prepared.',
    'order.eta':              'Arriving in',
    'order.notifyHint':       "You'll get notifications when it's on its way.",
    'order.track':            'Track Order',
    'order.continueShopping': 'Continue Shopping',

    // Orders list
    'orders.title':           'My Orders',
    'orders.total':           '{count} orders in total',
    'orders.totalOne':        '1 order in total',
    'orders.filter.all':       'All',
    'orders.filter.active':    'Active',
    'orders.filter.delivered': 'Delivered',
    'orders.filter.cancelled': 'Cancelled',
    'orders.empty.title':     'No orders yet',
    'orders.empty.subtitle':  'Your order history will show up here once you place one.',
    'orders.empty.nothing':   'Nothing here',
    'orders.empty.tryFilter': 'Try a different filter.',
    'orders.reorder':         '🔁 Reorder these items',
    'orders.reorderAdding':   'Adding to cart…',

    // Status
    'status.placed':           'Order Placed',
    'status.preparing':        'Preparing',
    'status.out_for_delivery': 'Out for Delivery',
    'status.delivered':        'Delivered',
    'status.cancelled':        'Cancelled',

    // Auth
    'auth.welcomeBack':       'Welcome back',
    'auth.signInSub':         'Sign in to your QuickKart account',
    'auth.email':             'Email',
    'auth.password':          'Password',
    'auth.signInBtn':         'Sign in',
    'auth.newHere':           'New here?',
    'auth.createAccount':     'Create an account',
    'auth.signupTitle':       'Create your account',
    'auth.signupSub':         'Sign up as a customer in 30 seconds',
    'auth.fullName':          'Full name',
    'auth.phone':             'Phone',
    'auth.phoneHint':         'Used by delivery agents to contact you.',
    'auth.confirmPassword':   'Confirm password',
    'auth.createBtn':         'Create account',
    'auth.alreadyHave':       'Already have an account?',
    'auth.termsHint':         'By creating an account you agree to our',
    'auth.terms':             'Terms of Service',
    'auth.privacy':           'Privacy Policy',
    'auth.checkEmail':        'Check your email',
    'auth.confirmSent':       'We sent a confirmation link to {email}.',
    'auth.confirmInstr':      'Click the link in your email to activate your account, then come back to sign in.',
    'auth.confirmFooter':     "Didn't get it? Check spam, or wait a minute and try again.",
    'auth.backToSignIn':      'Back to Sign In',

    // Bottom nav
    'nav.exit':               'Exit',

    // Profile
    'profile.title':          'My Profile',
    'profile.account':        'Account',
    'profile.password':       'Change password',
    'profile.addresses':      'Saved addresses',
    'profile.language':       'Language',
    'profile.notifications':  'Browser push notifications',

    // Misc
    'misc.outOfStock':        'Out of stock',
  },

  hi: {
    'common.add':         'जोड़ें',
    'common.save':        'सेव करें',
    'common.cancel':      'रद्द करें',
    'common.delete':      'हटाएं',
    'common.edit':        'संपादित करें',
    'common.back':        'वापस',
    'common.continue':    'जारी रखें',
    'common.confirm':     'पुष्टि करें',
    'common.loading':     'लोड हो रहा है…',
    'common.search':      'खोजें',
    'common.signOut':     'साइन आउट',
    'common.signIn':      'साइन इन',
    'common.register':    'खाता बनाएं',
    'common.profile':     'प्रोफ़ाइल',
    'common.orders':      'ऑर्डर',
    'common.home':        'होम',
    'common.minutes':     'मिनट',

    'greeting.hi':        'नमस्ते, {name}',
    'greeting.welcome':   'वापस आपका स्वागत है',
    'greeting.deliveringTo': 'डिलीवरी पता',

    'shop.searchPlaceholder': 'किराने, खाने, अंडे खोजें…',
    'shop.shopBy':            'श्रेणी से खरीदें',
    'shop.whatsInStore':      'दुकान में क्या है',
    'shop.results':           '"{query}" के परिणाम',
    'shop.itemsCount':        '{count} वस्तुएं',
    'shop.itemCount':         '{count} वस्तु',
    'shop.empty.title':       'कोई उत्पाद नहीं मिला',
    'shop.empty.noMatch':     '"{query}" से कुछ मेल नहीं खाता।',
    'shop.empty.checkBack':   'जल्द ही वापस आएं — कैटलॉग अपडेट हो रहा है।',
    'shop.recentSearches':    'हाल की खोज',
    'shop.clear':             'साफ़ करें',

    'product.add':            'जोड़ें',
    'product.outOfStock':     'स्टॉक में नहीं',
    'product.tapToView':      'देखने के लिए टैप करें',

    'cat.all':                'सभी',

    'cart.title':             'आपकी कार्ट',
    'cart.empty.title':       'आपकी कार्ट खाली है',
    'cart.empty.subtitle':    'शुरू करने के लिए हमारी दुकान से कुछ स्वादिष्ट उत्पाद जोड़ें।',
    'cart.empty.browse':      'उत्पाद ब्राउज़ करें',
    'cart.address':           'डिलीवरी पता',
    'cart.addAddress':        'नया जोड़ें',
    'cart.useLocation':       'मेरा वर्तमान स्थान उपयोग करें',
    'cart.locating':          'आपका स्थान ढूंढ रहे हैं…',
    'cart.payment':           'भुगतान विधि',
    'cart.payment.cod':       'कैश ऑन डिलीवरी',
    'cart.payment.online':    'ऑनलाइन भुगतान',
    'cart.payment.online.sub':'UPI, कार्ड, वॉलेट — जल्द आ रहा है',
    'cart.payment.cod.sub':   'डिलीवरी एजेंट को आगमन पर भुगतान करें',
    'cart.promoCode':         'प्रोमो कोड',
    'cart.promoApplied':      '{code} लागू किया गया',
    'cart.promoSaved':        'आपने {amount} बचाए',
    'cart.promoEnter':        'कोड दर्ज करें (जैसे WELCOME50)',
    'cart.promoApply':        'लागू करें',
    'cart.promoRemove':       'हटाएं',
    'cart.billDetails':       'बिल विवरण',
    'cart.itemTotal':         'वस्तु कुल',
    'cart.delivery':          'डिलीवरी शुल्क',
    'cart.taxes':             'कर और शुल्क',
    'cart.discount':          'कूपन छूट',
    'cart.toPay':             'भुगतान करें',
    'cart.free':              'मुफ़्त',
    'cart.freeDeliveryHint':  'मुफ्त डिलीवरी के लिए {amount} और जोड़ें',
    'cart.youSaved':          '🎉 आपने डिलीवरी पर बचत की',
    'cart.placeOrder':        'ऑर्डर दें',
    'cart.placing':           'दिया जा रहा है…',
    'cart.whatsappOrder':     'WhatsApp पर ऑर्डर दें',

    'order.placed':           'ऑर्डर दे दिया गया!',
    'order.preparing':        'ऑर्डर #{id} तैयार किया जा रहा है।',
    'order.eta':              'आगमन',
    'order.notifyHint':       'जब रास्ते में होगा तो आपको सूचना मिलेगी।',
    'order.track':            'ऑर्डर ट्रैक करें',
    'order.continueShopping': 'खरीदारी जारी रखें',

    'orders.title':           'मेरे ऑर्डर',
    'orders.total':           'कुल {count} ऑर्डर',
    'orders.totalOne':        'कुल 1 ऑर्डर',
    'orders.filter.all':       'सभी',
    'orders.filter.active':    'सक्रिय',
    'orders.filter.delivered': 'डिलीवर',
    'orders.filter.cancelled': 'रद्द',
    'orders.empty.title':     'अभी कोई ऑर्डर नहीं',
    'orders.empty.subtitle':  'जब आप ऑर्डर देंगे तो आपका इतिहास यहां दिखेगा।',
    'orders.empty.nothing':   'यहां कुछ नहीं है',
    'orders.empty.tryFilter': 'अलग फ़िल्टर आज़माएं।',
    'orders.reorder':         '🔁 दोबारा ऑर्डर करें',
    'orders.reorderAdding':   'कार्ट में जोड़ रहे हैं…',

    'status.placed':           'ऑर्डर दिया गया',
    'status.preparing':        'तैयार हो रहा है',
    'status.out_for_delivery': 'डिलीवरी के लिए निकला',
    'status.delivered':        'डिलीवर हो गया',
    'status.cancelled':        'रद्द',

    'auth.welcomeBack':       'वापस आपका स्वागत है',
    'auth.signInSub':         'अपने QuickKart खाते में साइन इन करें',
    'auth.email':             'ईमेल',
    'auth.password':          'पासवर्ड',
    'auth.signInBtn':         'साइन इन',
    'auth.newHere':           'नए हैं?',
    'auth.createAccount':     'खाता बनाएं',
    'auth.signupTitle':       'अपना खाता बनाएं',
    'auth.signupSub':         '30 सेकंड में ग्राहक के रूप में साइन अप करें',
    'auth.fullName':          'पूरा नाम',
    'auth.phone':             'फ़ोन',
    'auth.phoneHint':         'डिलीवरी एजेंट आपसे संपर्क करने के लिए इसका उपयोग करते हैं।',
    'auth.confirmPassword':   'पासवर्ड की पुष्टि करें',
    'auth.createBtn':         'खाता बनाएं',
    'auth.alreadyHave':       'पहले से खाता है?',
    'auth.termsHint':         'खाता बनाकर आप हमारी सहमत होते हैं',
    'auth.terms':             'सेवा की शर्तें',
    'auth.privacy':           'गोपनीयता नीति',
    'auth.checkEmail':        'अपना ईमेल देखें',
    'auth.confirmSent':       'हमने {email} पर एक पुष्टि लिंक भेजा है।',
    'auth.confirmInstr':      'खाता सक्रिय करने के लिए ईमेल में लिंक पर क्लिक करें, फिर साइन इन करने आएं।',
    'auth.confirmFooter':     'नहीं मिला? स्पैम देखें, या एक मिनट प्रतीक्षा करें।',
    'auth.backToSignIn':      'साइन इन पर वापस',

    'nav.exit':               'बाहर',

    'profile.title':          'मेरी प्रोफ़ाइल',
    'profile.account':        'खाता',
    'profile.password':       'पासवर्ड बदलें',
    'profile.addresses':      'सहेजे गए पते',
    'profile.language':       'भाषा',
    'profile.notifications':  'ब्राउज़र पुश सूचनाएं',

    'misc.outOfStock':        'स्टॉक में नहीं',
  },
};

/**
 * Resolve a key in the given locale, falling back to English when missing.
 * Supports {placeholder} interpolation.
 */
export function resolve(locale, key, vars = {}) {
  const dict = translations[locale] ?? translations.en;
  let str = dict[key] ?? translations.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`{${k}}`, 'g'), String(v));
  }
  return str;
}
