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

    if (walletProjectId && typeof WalletModule !== 'undefined' && WalletModule.init) {
      try {
        await WalletModule.init(walletProjectId);
        updateWalletBtn(!!WalletModule.isConnected && WalletModule.isConnected());
      } catch (e) {
        console.warn('[Main] Silent wallet init failed:', e);
      }
    }
  } catch (e) {
    console.warn('[Main] Could not load wallet config:', e);
    walletProjectId = '';
  }
}
loadWalletConfig();

window.addEventListener('walletConnected', () => {
  updateWalletBtn(true);
});

window.addEventListener('walletDisconnected', () => {
  updateWalletBtn(false);
});

function handleWalletClick() {
  console.log('[Main] Wallet button clicked');
  if (typeof WalletModule !== 'undefined' && WalletModule.isConnected && WalletModule.isConnected()) {
    WalletModule.disconnectWallet().then(() => {
      updateWalletBtn(false);
    }).catch(() => {});
    return;
  }
  console.log('[Main] Opening wallet selector...');
  showWalletSelector(walletProjectId)
    .then((result) => {
      console.log('[Main] Wallet connected via', result.type);
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
