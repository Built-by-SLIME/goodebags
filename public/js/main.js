/* ═══════════════════════════════════════════
   WALLET CONNECT — AppKit / WalletConnect v2
═══════════════════════════════════════════ */
const walletBtn = document.getElementById('walletBtn');
const walletBtnMobile = document.getElementById('walletBtnMobile');

let walletProjectId = null;

function updateWalletBtn(connected) {
  const text = connected ? 'Disconnect' : 'Connect Wallet';
  walletBtn.textContent = text;
  if (walletBtnMobile) walletBtnMobile.textContent = text;
}

async function loadWalletConfig() {
  try {
    console.log('[Main] Fetching /api/config...');
    const res = await fetch('/api/config');
    const cfg = await res.json();
    walletProjectId = cfg.walletConnectProjectId || '';
    console.log('[Main] Project ID loaded:', walletProjectId ? 'yes' : 'no');

    if (cfg.xamanApiKey) initWalletSelector(cfg.xamanApiKey);

    let connected = false;

    if (walletProjectId && typeof WalletModule !== 'undefined' && WalletModule.init) {
      try {
        await WalletModule.init(walletProjectId);
        connected = !!WalletModule.isConnected && WalletModule.isConnected();
      } catch (e) {
        console.warn('[Main] Silent wallet init failed:', e);
      }
    }

    if (!connected && cfg.xamanApiKey) {
      try {
        const xamanAccount = await getXamanAccount(cfg.xamanApiKey);
        connected = !!xamanAccount;
      } catch (e) {}
    }

    updateWalletBtn(connected);
  } catch (e) {
    console.warn('[Main] Could not load wallet config:', e);
    walletProjectId = '';
  }
}
loadWalletConfig();

window.addEventListener('walletConnected', () => {
  // Try to capture and store wallet info from WalletModule for cross-page sharing
  if (typeof WalletModule !== 'undefined' && typeof WalletModule.getAddress === 'function') {
    const address = WalletModule.getAddress();
    if (address) {
      let chain = 'unknown';
      const s = typeof WalletModule.getSession === 'function' ? WalletModule.getSession() : null;
      if (s && s.namespaces) {
        for (const nsKey of Object.keys(s.namespaces)) {
          if (nsKey.includes('hedera')) { chain = 'hedera'; break; }
          if (nsKey.includes('xrpl')) { chain = 'xrpl'; break; }
        }
      }
      localStorage.setItem('gb_wcAddress', address);
      localStorage.setItem('gb_wcChain', chain);
      localStorage.removeItem('gb_xamanAccount');
    }
  }
  updateWalletBtn(true);
});

window.addEventListener('walletDisconnected', () => {
  localStorage.removeItem('gb_wcAddress');
  localStorage.removeItem('gb_wcChain');
  updateWalletBtn(false);
});

// Detect Xaman auth completion from other tabs (mobile redirect opens new tab)
window.addEventListener('storage', (e) => {
  if (e.key === 'gb_xamanAccount') {
    if (e.newValue) {
      console.log('[Main] Xaman auth detected from another tab:', e.newValue);
      localStorage.removeItem('gb_wcAddress');
      localStorage.removeItem('gb_wcChain');
      updateWalletBtn(true);
    } else {
      console.log('[Main] Xaman logout detected from another tab');
      updateWalletBtn(false);
    }
  }
});

// Detect sessions when browser becomes visible (mobile backgrounding fix)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  // Check WalletConnect session
  if (typeof WalletModule !== 'undefined' && WalletModule.isConnected && WalletModule.isConnected()) {
    console.log('[Main] WalletConnect session detected on visibility change');
    updateWalletBtn(true);
    return;
  }
  // Check Xaman session from localStorage
  if (localStorage.getItem('gb_xamanAccount')) {
    console.log('[Main] Xaman session detected on visibility change');
    updateWalletBtn(true);
    return;
  }
  // Check WalletConnect session from localStorage (cross-page fallback)
  if (localStorage.getItem('gb_wcAddress')) {
    console.log('[Main] WalletConnect session detected from localStorage on visibility change');
    updateWalletBtn(true);
  }
});

// Periodic polling to catch sessions that arrived while browser was backgrounded
setInterval(() => {
  if (typeof WalletModule !== 'undefined' && WalletModule.isConnected && WalletModule.isConnected()) {
    updateWalletBtn(true);
    return;
  }
  if (localStorage.getItem('gb_xamanAccount')) {
    updateWalletBtn(true);
    return;
  }
  if (localStorage.getItem('gb_wcAddress')) {
    updateWalletBtn(true);
  }
}, 3000);

async function handleWalletClick() {
  console.log('[Main] Wallet button clicked');

  // Disconnect WalletConnect if connected
  if (typeof WalletModule !== 'undefined' && WalletModule.isConnected && WalletModule.isConnected()) {
    await WalletModule.disconnectWallet().catch(() => {});
    localStorage.removeItem('gb_wcAddress');
    localStorage.removeItem('gb_wcChain');
    updateWalletBtn(false);
    return;
  }

  // Disconnect Xaman if connected
  if (localStorage.getItem('gb_xamanAccount')) {
    xummLogout();
    updateWalletBtn(false);
    return;
  }

  console.log('[Main] Opening wallet selector...');
  showWalletSelector(walletProjectId)
    .then((result) => {
      console.log('[Main] Wallet connected via', result.type);
      if (result.type === 'wc') {
        localStorage.setItem('gb_wcAddress', result.address);
        localStorage.setItem('gb_wcChain', result.chain);
        localStorage.removeItem('gb_xamanAccount');
      } else if (result.type === 'xaman') {
        localStorage.removeItem('gb_wcAddress');
        localStorage.removeItem('gb_wcChain');
      }
      updateWalletBtn(true);
    })
    .catch((err) => {
      if (err.message === 'User cancelled') return;
      console.error('[Main] Wallet connection failed:', err);
    });
}

walletBtn.addEventListener('click', handleWalletClick);
if (walletBtnMobile) walletBtnMobile.addEventListener('click', handleWalletClick);

/* ═══════════════════════════════════════════
   NAVBAR — scroll effect + mobile toggle
═══════════════════════════════════════════ */
const navbar    = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');

// Scroll: add .scrolled class
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

// Mobile hamburger toggle
hamburger.addEventListener('click', () => {
  const isOpen = hamburger.classList.toggle('open');
  navLinks.classList.toggle('open', isOpen);
  hamburger.setAttribute('aria-expanded', isOpen);
});

// Close mobile nav on link or button click
navLinks.querySelectorAll('a, button').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
  });
});

/* ═══════════════════════════════════════════
   FAQ — accordion
═══════════════════════════════════════════ */
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const isOpen   = btn.getAttribute('aria-expanded') === 'true';
    const answer   = btn.nextElementSibling;
    const faqItem  = btn.closest('.faq-item');

    // Close all
    document.querySelectorAll('.faq-question').forEach(q => {
      q.setAttribute('aria-expanded', 'false');
      q.nextElementSibling.classList.remove('open');
      q.closest('.faq-item').classList.remove('active');
    });

    // Open clicked (if it was closed)
    if (!isOpen) {
      btn.setAttribute('aria-expanded', 'true');
      answer.classList.add('open');
      faqItem.classList.add('active');
    }
  });
});

/* ═══════════════════════════════════════════
   SCROLL ANIMATIONS — fade in on viewport entry
═══════════════════════════════════════════ */
const fadeEls = document.querySelectorAll(
  '.hero-text, .hero-visual, .split-text-col, .split-img-col, ' +
  '.section-header, .nft-card, .faq-header, .faq-list, ' +
  '.cta-text, .cta-img, .footer-brand, .footer-links-group, .footer-newsletter'
);

fadeEls.forEach(el => el.classList.add('fade-in'));

const observer = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

fadeEls.forEach(el => observer.observe(el));

/* ═══════════════════════════════════════════
   SMOOTH ACTIVE NAV LINK on scroll
═══════════════════════════════════════════ */
const sections = document.querySelectorAll('section[id]');
const navItems = document.querySelectorAll('.nav-links a');

const sectionObserver = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navItems.forEach(a => {
          a.style.color = a.getAttribute('href') === `#${id}` ? '#fff' : '';
        });
      }
    });
  },
  { rootMargin: '-40% 0px -40% 0px' }
);

sections.forEach(s => sectionObserver.observe(s));
