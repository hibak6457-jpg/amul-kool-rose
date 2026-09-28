/**
 * AMUL KOOL ROSE — Interactive 3D Scroll Experience
 * High-performance frame interpolation, Canvas rendering & Web Audio API
 */

(function () {
  'use strict';

  // --- CONFIGURATION ---
  const TOTAL_FRAMES = 240;
  const FRAME_DIR = 'ezgif-331ba197f1e39c93-jpg';
  const FRAME_PREFIX = 'ezgif-frame-';
  const FRAME_EXT = '.jpg';

  // --- STATE ---
  const state = {
    frames: new Array(TOTAL_FRAMES),
    loadedCount: 0,
    currentProgress: 0,
    targetProgress: 0,
    currentFrameIndex: 0,
    isPlayingTour: false,
    soundEnabled: false,
    audioCtx: null,
    ambientGain: null,
    cartCount: 2,
    cartPrice: 25,
    isCartOpen: false
  };

  // --- DOM ELEMENTS ---
  const preloader = document.getElementById('preloader');
  const loaderBar = document.getElementById('loader-bar');
  const loaderPercent = document.getElementById('loader-percent');
  const loaderStatus = document.getElementById('loader-status');
  const skipBtn = document.getElementById('skip-loader-btn');

  const canvas = document.getElementById('animation-canvas');
  const ctx = canvas.getContext('2d');
  const heroTrack = document.getElementById('hero-track');

  const hudPlayBtn = document.getElementById('hud-play-btn');
  const hudPlayIcon = document.getElementById('hud-play-icon');
  const hudFrameNum = document.getElementById('hud-frame-num');
  const hudScrubber = document.getElementById('hud-scrubber');
  const teleTemp = document.getElementById('tele-temp');
  const teleScroll = document.getElementById('tele-scroll');
  const scrubberTicks = document.querySelectorAll('.scrubber-ticks .tick');

  const storySteps = document.querySelectorAll('.story-step');
  const soundBtn = document.getElementById('sound-btn');
  const tourBtn = document.getElementById('tour-btn');
  const cartOpenBtn = document.getElementById('cart-open-btn');
  const cartDrawer = document.getElementById('cart-drawer');
  const cartOverlay = document.getElementById('cart-overlay');
  const cartCloseBtn = document.getElementById('cart-close-btn');
  const toast = document.getElementById('toast');

  // --- HELPER: FRAME PATH ---
  function getFramePath(index) {
    const num = String(index + 1).padStart(3, '0');
    return `${FRAME_DIR}/${FRAME_PREFIX}${num}${FRAME_EXT}`;
  }

  // --- PRELOAD ENGINE ---
  function preloadImages() {
    let loaded = 0;

    // Load Frame 1 first for immediate visual feedback
    const firstImg = new Image();
    firstImg.src = getFramePath(0);
    firstImg.onload = () => {
      state.frames[0] = firstImg;
      renderCurrentFrame();
    };

    // Load all remaining frames
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getFramePath(i);

      img.onload = () => {
        state.frames[i] = img;
        loaded++;
        state.loadedCount = loaded;

        const percent = Math.floor((loaded / TOTAL_FRAMES) * 100);
        loaderBar.style.width = `${percent}%`;
        loaderPercent.textContent = `${percent}%`;

        if (percent > 30) {
          skipBtn.classList.remove('hidden');
        }

        if (percent === 100) {
          loaderStatus.textContent = 'Ready to Splash!';
          setTimeout(dismissPreloader, 400);
        }
      };

      img.onerror = () => {
        // Retry or fallback
        loaded++;
        if (loaded >= TOTAL_FRAMES) {
          dismissPreloader();
        }
      };
    }
  }

  function dismissPreloader() {
    if (preloader.classList.contains('loaded')) return;
    preloader.classList.add('loaded');
    resizeCanvas();
    renderCurrentFrame();
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', dismissPreloader);
  }

  // --- CANVAS RESIZE & HI-DPI RENDERING ---
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    renderCurrentFrame();
  }

  window.addEventListener('resize', resizeCanvas);

  // Draw current frame with responsive aspect-ratio fitting
  function renderCurrentFrame() {
    const targetIdx = Math.min(TOTAL_FRAMES - 1, Math.max(0, state.currentFrameIndex));
    let img = state.frames[targetIdx];

    // Fallback to nearest loaded frame if current isn't ready
    if (!img || !img.complete) {
      for (let offset = 1; offset < 20; offset++) {
        if (state.frames[targetIdx - offset]?.complete) {
          img = state.frames[targetIdx - offset];
          break;
        }
        if (state.frames[targetIdx + offset]?.complete) {
          img = state.frames[targetIdx + offset];
          break;
        }
      }
    }

    if (!img || !img.complete) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, width, height);

    // Contain scaling calculation
    const imgRatio = img.width / img.height;
    const canvasRatio = width / height;

    let drawW, drawH, drawX, drawY;

    if (canvasRatio > imgRatio) {
      drawH = height;
      drawW = height * imgRatio;
      drawX = (width - drawW) / 2;
      drawY = 0;
    } else {
      drawW = width;
      drawH = width / imgRatio;
      drawX = 0;
      drawY = (height - drawH) / 2;
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }

  // --- SCROLL CALCULATION & INTERPOLATION ---
  function updateScrollProgress() {
    const trackRect = heroTrack.getBoundingClientRect();
    const scrollable = heroTrack.offsetHeight - window.innerHeight;

    if (scrollable <= 0) return;

    const scrolled = -trackRect.top;
    const progress = Math.min(1, Math.max(0, scrolled / scrollable));
    state.targetProgress = progress;
  }

  window.addEventListener('scroll', () => {
    if (!state.isPlayingTour) {
      updateScrollProgress();
    }
  }, { passive: true });

  // Milestone sounds trigger flag
  let lastMilestone = 0;

  // --- RENDER LOOP (BUTTER SMOOTH LERP) ---
  function animationLoop() {
    // Smooth lerp interpolation
    const lerpFactor = 0.14;
    state.currentProgress += (state.targetProgress - state.currentProgress) * lerpFactor;

    // Calculate frame index
    const frameIndex = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(state.currentProgress * (TOTAL_FRAMES - 1))));

    if (frameIndex !== state.currentFrameIndex) {
      state.currentFrameIndex = frameIndex;
      renderCurrentFrame();
      updateHUD(frameIndex, state.currentProgress);
      updateNarrativeSteps(state.currentProgress);

      // Procedural audio milestone triggers
      const currentMilestone = Math.floor(state.currentProgress * 4);
      if (currentMilestone !== lastMilestone) {
        lastMilestone = currentMilestone;
        playDropletSound();
      }
    }

    // Auto Tour Handling
    if (state.isPlayingTour) {
      state.targetProgress += 0.0022;
      if (state.targetProgress >= 1) {
        state.targetProgress = 0;
      }
      const scrollable = heroTrack.offsetHeight - window.innerHeight;
      window.scrollTo(0, heroTrack.offsetTop + (state.targetProgress * scrollable));
    }

    requestAnimationFrame(animationLoop);
  }

  // --- HUD & TELEMETRY UPDATES ---
  function updateHUD(frameIndex, progress) {
    if (hudFrameNum) {
      hudFrameNum.textContent = `${String(frameIndex + 1).padStart(3, '0')} / ${TOTAL_FRAMES}`;
    }

    if (hudScrubber && document.activeElement !== hudScrubber) {
      hudScrubber.value = frameIndex;
    }

    if (teleScroll) {
      teleScroll.textContent = `${Math.round(progress * 100)}%`;
    }

    if (teleTemp) {
      // Dynamic simulated temperature from 4.2°C down to 3.4°C during active splash
      const temp = (4.2 - (progress * 0.8)).toFixed(1);
      teleTemp.textContent = `${temp}°C`;
    }

    // Update scrubber tick highlighting
    scrubberTicks.forEach(tick => {
      const targetFrame = parseInt(tick.dataset.frame, 10);
      if (Math.abs(frameIndex - targetFrame) < 30) {
        tick.classList.add('active');
      } else {
        tick.classList.remove('active');
      }
    });
  }

  // --- NARRATIVE MILESTONE STEPS ---
  function updateNarrativeSteps(progress) {
    let activeStep = 1;

    if (progress < 0.22) {
      activeStep = 1;
    } else if (progress >= 0.22 && progress < 0.50) {
      activeStep = 2;
    } else if (progress >= 0.50 && progress < 0.76) {
      activeStep = 3;
    } else {
      activeStep = 4;
    }

    storySteps.forEach(step => {
      const stepNum = parseInt(step.dataset.step, 10);
      if (stepNum === activeStep) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });
  }

  // --- SCRUBBER CONTROLLER ---
  if (hudScrubber) {
    hudScrubber.addEventListener('input', (e) => {
      const frame = parseInt(e.target.value, 10);
      const progress = frame / (TOTAL_FRAMES - 1);
      const scrollable = heroTrack.offsetHeight - window.innerHeight;
      window.scrollTo({
        top: heroTrack.offsetTop + (progress * scrollable),
        behavior: 'auto'
      });
      state.targetProgress = progress;
      if (state.isPlayingTour) toggleAutoTour(false);
    });
  }

  // Scrubber Ticks Click
  scrubberTicks.forEach(tick => {
    tick.addEventListener('click', () => {
      const targetFrame = parseInt(tick.dataset.frame, 10);
      const progress = targetFrame / (TOTAL_FRAMES - 1);
      const scrollable = heroTrack.offsetHeight - window.innerHeight;
      window.scrollTo({
        top: heroTrack.offsetTop + (progress * scrollable),
        behavior: 'smooth'
      });
      playDropletSound();
    });
  });

  // --- AUTO TOUR CONTROLLER ---
  function toggleAutoTour(forceState) {
    state.isPlayingTour = typeof forceState === 'boolean' ? forceState : !state.isPlayingTour;

    if (hudPlayIcon) {
      hudPlayIcon.textContent = state.isPlayingTour ? '⏸' : '▶';
    }
    if (tourBtn) {
      const text = tourBtn.querySelector('.tour-text');
      if (text) text.textContent = state.isPlayingTour ? 'Pause Tour' : 'Auto Tour';
      tourBtn.style.background = state.isPlayingTour ? 'rgba(232, 93, 117, 0.4)' : '';
    }

    if (state.isPlayingTour && !state.soundEnabled) {
      initAudio();
      toggleSound(true);
    }
  }

  if (hudPlayBtn) hudPlayBtn.addEventListener('click', () => toggleAutoTour());
  if (tourBtn) tourBtn.addEventListener('click', () => toggleAutoTour());

  // Stop auto tour on user scroll interaction
  window.addEventListener('wheel', () => {
    if (state.isPlayingTour) toggleAutoTour(false);
  }, { passive: true });

  window.addEventListener('touchstart', () => {
    if (state.isPlayingTour) toggleAutoTour(false);
  }, { passive: true });

  // --- WEB AUDIO API PROCEDURAL SOUND ENGINE ---
  function initAudio() {
    if (state.audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AudioContext();

    // Ambient Master Gain
    state.ambientGain = state.audioCtx.createGain();
    state.ambientGain.gain.setValueAtTime(0, state.audioCtx.currentTime);
    state.ambientGain.connect(state.audioCtx.destination);

    // Warm chord pad synthesizer (Procedural chilled breeze)
    const freqs = [196.00, 246.94, 293.66, 392.00]; // G, B, D, G (Chill Rose Chord)
    freqs.forEach(f => {
      const osc = state.audioCtx.createOscillator();
      const oscGain = state.audioCtx.createGain();
      const filter = state.audioCtx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, state.audioCtx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, state.audioCtx.currentTime);

      oscGain.gain.setValueAtTime(0.04, state.audioCtx.currentTime);

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(state.ambientGain);
      osc.start();
    });
  }

  function toggleSound(force) {
    initAudio();
    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }

    state.soundEnabled = typeof force === 'boolean' ? force : !state.soundEnabled;

    if (soundBtn) {
      soundBtn.classList.toggle('playing', state.soundEnabled);
    }

    if (state.soundEnabled) {
      state.ambientGain.gain.setTargetAtTime(0.18, state.audioCtx.currentTime, 0.4);
      showToast('♫ Chill Soundscape Activated');
    } else {
      state.ambientGain.gain.setTargetAtTime(0, state.audioCtx.currentTime, 0.2);
      showToast('Audio Muted');
    }
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', () => toggleSound());
  }

  // Procedural Liquid Droplet Sound
  function playDropletSound() {
    if (!state.soundEnabled || !state.audioCtx) return;

    try {
      const now = state.audioCtx.currentTime;
      const osc = state.audioCtx.createOscillator();
      const gain = state.audioCtx.createGain();

      osc.type = 'sine';
      // Pitch drop creates bubbly water drop
      osc.frequency.setValueAtTime(900 + Math.random() * 200, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(state.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.14);
    } catch (e) {
      console.warn('Audio play dropped:', e);
    }
  }

  // --- INTERACTIVE FLAVOUR SELECTOR ---
  const FLAVOUR_DATA = {
    rose: {
      tag: 'ROYAL FLORAL BLEND',
      title: 'Amul KOOL Rose',
      desc: 'Sweet, fragrant, and profoundly soothing. Distilled Damask rose petals blended seamlessly with whole cow milk for an unforgettable summer treat.',
      energy: '112 kcal',
      protein: '3.6g',
      calcium: '125mg',
      emoji: '🌹',
      glow: 'rgba(232, 93, 117, 0.45)'
    },
    kesar: {
      tag: 'KASHMIRI SAFFRON DELIGHT',
      title: 'Amul KOOL Kesar',
      desc: 'Infused with golden strands of certified Kashmiri saffron and delicate cardamom undertones. A regal immunity booster of royal heritage.',
      energy: '118 kcal',
      protein: '3.7g',
      calcium: '130mg',
      emoji: '👑',
      glow: 'rgba(244, 162, 38, 0.45)'
    },
    badam: {
      tag: 'CRUNCHY ROASTED ALMOND',
      title: 'Amul KOOL Badam',
      desc: 'Packed with real roasted Californian almond bits, rich dairy cream, and subtle saffron warmth. Nutritious power in every mouthful.',
      energy: '124 kcal',
      protein: '4.1g',
      calcium: '135mg',
      emoji: '🌰',
      glow: 'rgba(212, 163, 115, 0.45)'
    },
    elaichi: {
      tag: 'AROMATIC SPICE CHILL',
      title: 'Amul KOOL Elaichi',
      desc: 'Green cardamom pods stone-ground and folded into thick cold milk. Digestively comforting and remarkably refreshing.',
      energy: '110 kcal',
      protein: '3.5g',
      calcium: '122mg',
      emoji: '🌿',
      glow: 'rgba(128, 185, 24, 0.45)'
    },
    cafe: {
      tag: 'CHILLED ROBUSTA ESPRESSO',
      title: 'Amul KOOL Cafe',
      desc: 'Single-origin roasted coffee beans infused in velvety milk shake. The ultimate wake-up call for active commuters and creators.',
      energy: '116 kcal',
      protein: '3.8g',
      calcium: '120mg',
      emoji: '☕',
      glow: 'rgba(141, 91, 76, 0.45)'
    }
  };

  const flavourTabs = document.querySelectorAll('.flavour-tab');
  const flavourTag = document.getElementById('flavour-tag');
  const flavourTitle = document.getElementById('flavour-title');
  const flavourDesc = document.getElementById('flavour-desc');
  const flavourEnergy = document.getElementById('flavour-energy');
  const flavourProtein = document.getElementById('flavour-protein');
  const flavourCalcium = document.getElementById('flavour-calcium');
  const flavourIcon = document.getElementById('flavour-icon');
  const flavourAmbient = document.getElementById('flavour-ambient');
  const flavourAddBtn = document.getElementById('flavour-add-btn');

  flavourTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      flavourTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const key = tab.dataset.flavor;
      const data = FLAVOUR_DATA[key];
      if (!data) return;

      if (flavourTag) flavourTag.textContent = data.tag;
      if (flavourTitle) flavourTitle.textContent = data.title;
      if (flavourDesc) flavourDesc.textContent = data.desc;
      if (flavourEnergy) flavourEnergy.textContent = data.energy;
      if (flavourProtein) flavourProtein.textContent = data.protein;
      if (flavourCalcium) flavourCalcium.textContent = data.calcium;
      if (flavourIcon) flavourIcon.textContent = data.emoji;
      if (flavourAmbient) flavourAmbient.style.background = `radial-gradient(circle, ${data.glow} 0%, rgba(0,0,0,0) 70%)`;

      playDropletSound();
    });
  });

  if (flavourAddBtn) {
    flavourAddBtn.addEventListener('click', () => {
      const activeTab = document.querySelector('.flavour-tab.active');
      const name = activeTab ? activeTab.textContent.trim() : 'Rose';
      updateCart(1);
      showToast(`Added Amul KOOL ${name} to your basket!`);
      playDropletSound();
    });
  }

  // --- CART DRAWER LOGIC ---
  const cartBadge = document.getElementById('cart-count');
  const cartQty = document.getElementById('cart-qty');
  const cartSubtotal = document.getElementById('cart-item-subtotal');
  const cartTotalVal = document.getElementById('cart-total-val');
  const qtyPlus = document.getElementById('qty-plus');
  const qtyMinus = document.getElementById('qty-minus');
  const upgradePackBtn = document.getElementById('upgrade-pack-btn');
  const checkoutBtn = document.getElementById('checkout-btn');

  function openCart() {
    state.isCartOpen = true;
    if (cartDrawer) cartDrawer.classList.add('open');
    if (cartOverlay) cartOverlay.classList.add('open');
  }

  function closeCart() {
    state.isCartOpen = false;
    if (cartDrawer) cartDrawer.classList.remove('open');
    if (cartOverlay) cartOverlay.classList.remove('open');
  }

  function updateCart(delta) {
    state.cartCount = Math.max(1, state.cartCount + delta);
    const total = state.cartCount * state.cartPrice;

    if (cartBadge) cartBadge.textContent = state.cartCount;
    if (cartQty) cartQty.textContent = state.cartCount;
    if (cartSubtotal) cartSubtotal.textContent = `₹${total.toFixed(2)}`;
    if (cartTotalVal) cartTotalVal.textContent = `₹${total.toFixed(2)}`;
  }

  if (cartOpenBtn) cartOpenBtn.addEventListener('click', openCart);
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCart);
  if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

  if (qtyPlus) qtyPlus.addEventListener('click', () => updateCart(1));
  if (qtyMinus) qtyMinus.addEventListener('click', () => updateCart(-1));

  if (upgradePackBtn) {
    upgradePackBtn.addEventListener('click', () => {
      state.cartCount = 6;
      state.cartPrice = 23.33; // ~₹140 for 6 pack
      updateCart(0);
      showToast('🎉 Upgraded to 6-Pack Party Box (Saved ₹10)!');
      playDropletSound();
    });
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      showToast('🚀 Order placed with Anand Cold-Chain Hub! Chilled bottles dispatched.');
      setTimeout(closeCart, 1000);
      playDropletSound();
    });
  }

  // Secondary CTA buttons on final slide
  document.querySelectorAll('.add-pack-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const variant = btn.dataset.variant;
      if (variant === 'box6') {
        state.cartCount = 6;
        state.cartPrice = 24.16;
      } else {
        updateCart(1);
      }
      updateCart(0);
      openCart();
      playDropletSound();
    });
  });

  // Footer Actions
  const footerRestart = document.getElementById('footer-restart-btn');
  const footerSound = document.getElementById('footer-sound-btn');

  if (footerRestart) {
    footerRestart.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (footerSound) {
    footerSound.addEventListener('click', () => toggleSound());
  }

  // --- TOAST NOTIFICATIONS ---
  let toastTimer;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // --- CUSTOM CURSOR GLOW ---
  const cursorDot = document.getElementById('cursor-dot');
  const cursorGlow = document.getElementById('cursor-glow');

  if (cursorDot && cursorGlow && window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('mousemove', (e) => {
      cursorDot.style.left = `${e.clientX}px`;
      cursorDot.style.top = `${e.clientY}px`;

      cursorGlow.style.left = `${e.clientX}px`;
      cursorGlow.style.top = `${e.clientY}px`;
    });

    document.querySelectorAll('button, a, input').forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursorGlow.style.transform = 'translate(-50%, -50%) scale(1.6)';
        cursorGlow.style.background = 'rgba(232, 93, 117, 0.35)';
      });
      el.addEventListener('mouseleave', () => {
        cursorGlow.style.transform = 'translate(-50%, -50%) scale(1)';
        cursorGlow.style.background = 'rgba(232, 93, 117, 0.2)';
      });
    });
  } else {
    if (cursorDot) cursorDot.style.display = 'none';
    if (cursorGlow) cursorGlow.style.display = 'none';
  }

  // --- START INITIALIZATION ---
  preloadImages();
  resizeCanvas();
  updateScrollProgress();
  requestAnimationFrame(animationLoop);

})();
