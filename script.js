(function () {
  'use strict';

  /* ── Config ── */
  var AUTO_INTERVAL = 3500;   // ms between auto-slides
  var PAUSE_ON_HOVER = true;
  var DRAG_THRESHOLD = 40;    // px before a drag registers as a slide

  /* ── Elements ── */
  var viewport  = document.getElementById('sliderViewport');
  var track     = document.getElementById('sliderTrack');
  var arrowL    = document.getElementById('arrowLeft');
  var arrowR    = document.getElementById('arrowRight');
  var dotsWrap  = document.getElementById('sliderDots');
  var cards     = Array.from(track.querySelectorAll('.course-card'));

  /* ── State ── */
  var cardWidth   = 0;
  var gap         = 20;        // px — matches CSS gap: 1.25rem ≈ 20px
  var visibleCount = 3;
  var currentIndex = 0;
  var maxIndex     = 0;
  var autoTimer    = null;
  var isPaused     = false;

  /* Drag state */
  var drag = {
    active: false,
    startX: 0,
    startTranslate: 0,
    currentTranslate: 0,
    lastX: 0
  };

  /* ── Init ── */
  function init() {
    measure();
    buildDots();
    updateArrows();
    applyTranslate(false);
    startAuto();
    bindEvents();
  }

  /* ── Measure card/gap from DOM ── */
  function measure() {
    var style     = getComputedStyle(track);
    var gapVal    = parseFloat(style.gap || style.columnGap || '20');
    gap           = isNaN(gapVal) ? 20 : gapVal;

    var viewW     = viewport.clientWidth - parseFloat(getComputedStyle(viewport).paddingLeft) * 2;
    cardWidth     = cards.length ? cards[0].offsetWidth : 260;

    /* how many cards fit fully */
    visibleCount  = Math.max(1, Math.floor((viewW + gap) / (cardWidth + gap)));
    maxIndex      = Math.max(0, cards.length - visibleCount);

    /* clamp currentIndex in case window shrank */
    if (currentIndex > maxIndex) currentIndex = maxIndex;
  }

  /* ── Translate helpers ── */
  function getTranslateX(idx) {
    return -idx * (cardWidth + gap);
  }

  function applyTranslate(animate) {
    if (!animate) track.classList.add('no-transition');
    track.style.transform = 'translateX(' + getTranslateX(currentIndex) + 'px)';
    if (!animate) {
      /* force reflow then re-enable transitions */
      track.offsetHeight; // eslint-disable-line no-unused-expressions
      track.classList.remove('no-transition');
    }
  }

  /* ── Navigation ── */
  function goTo(idx, skipAutoReset) {
    if (idx < 0) idx = 0;
    if (idx > maxIndex) idx = maxIndex;
    currentIndex = idx;
    applyTranslate(true);
    updateDots();
    updateArrows();
    if (!skipAutoReset) resetAuto();
  }

  function prev() { goTo(currentIndex - 1); }
  function next() {
    /* at last page → loop back to 0 */
    goTo(currentIndex >= maxIndex ? 0 : currentIndex + 1);
  }

  /* ── Arrows ── */
  function updateArrows() {
    arrowL.disabled = currentIndex <= 0;
    arrowR.disabled = currentIndex >= maxIndex;
  }

  /* ── Dots ── */
  function buildDots() {
    dotsWrap.innerHTML = '';
    var total = maxIndex + 1;
    for (var i = 0; i < total; i++) {
      (function (idx) {
        var btn = document.createElement('button');
        btn.className = 'dot' + (idx === 0 ? ' active' : '');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-label', 'Go to slide ' + (idx + 1));
        btn.onclick = function () { goTo(idx); };
        dotsWrap.appendChild(btn);
      }(i));
    }
  }

  function updateDots() {
    var allDots = dotsWrap.querySelectorAll('.dot');
    allDots.forEach(function (d, i) {
      d.classList.toggle('active', i === currentIndex);
      d.setAttribute('aria-selected', i === currentIndex ? 'true' : 'false');
    });
  }

  /* ── Auto-slide ── */
  function startAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(function () {
      if (!isPaused) next();
    }, AUTO_INTERVAL);
  }

  function resetAuto() {
    clearInterval(autoTimer);
    startAuto();
  }

  function pauseAuto()  { isPaused = true; }
  function resumeAuto() { isPaused = false; }

  /* ── Drag (mouse + touch) ── */
  function onPointerDown(e) {
    drag.active = true;
    drag.startX = getClientX(e);
    drag.lastX  = drag.startX;
    drag.startTranslate = getTranslateX(currentIndex);
    drag.currentTranslate = drag.startTranslate;
    track.classList.add('no-transition');
    viewport.classList.add('dragging');
    pauseAuto();
  }

  function onPointerMove(e) {
    if (!drag.active) return;
    var x   = getClientX(e);
    var diff = x - drag.startX;
    drag.lastX = x;
    drag.currentTranslate = drag.startTranslate + diff;

    /* clamp a bit so you can't drag too far past edges */
    var min = getTranslateX(maxIndex) - 60;
    var max = getTranslateX(0)        + 60;
    if (drag.currentTranslate < min) drag.currentTranslate = min;
    if (drag.currentTranslate > max) drag.currentTranslate = max;

    track.style.transform = 'translateX(' + drag.currentTranslate + 'px)';
  }

  function onPointerUp(e) {
    if (!drag.active) return;
    drag.active = false;
    track.classList.remove('no-transition');
    viewport.classList.remove('dragging');

    var diff = getClientX(e) - drag.startX;

    if (Math.abs(diff) >= DRAG_THRESHOLD) {
      if (diff < 0) {
        goTo(currentIndex >= maxIndex ? 0 : currentIndex + 1, true);
      } else {
        goTo(currentIndex > 0 ? currentIndex - 1 : 0, true);
      }
    } else {
      /* snap back */
      applyTranslate(true);
    }
    resetAuto();
    resumeAuto();
  }

  function getClientX(e) {
    if (e.touches && e.touches.length) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientX;
    return e.clientX;
  }

  /* prevent image drag */
  function preventDrag(e) { e.preventDefault(); }

  /* ── Keyboard ── */
  function onKeyDown(e) {
    if (e.key === 'ArrowLeft')  { prev(); }
    if (e.key === 'ArrowRight') { next(); }
  }

  /* ── Resize ── */
  var resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      measure();
      buildDots();
      updateArrows();
      applyTranslate(false);
    }, 160);
  }

  /* ── Bind all events ── */
  function bindEvents() {
    /* arrows */
    arrowL.addEventListener('click', prev);
    arrowR.addEventListener('click', next);

    /* keyboard */
    document.addEventListener('keydown', onKeyDown);

    /* hover pause */
    if (PAUSE_ON_HOVER) {
      viewport.addEventListener('mouseenter', pauseAuto);
      viewport.addEventListener('mouseleave', resumeAuto);
    }

    /* mouse drag */
    viewport.addEventListener('mousedown',  onPointerDown);
    window.addEventListener('mousemove',   onPointerMove);
    window.addEventListener('mouseup',     onPointerUp);

    /* touch drag */
    viewport.addEventListener('touchstart', onPointerDown, { passive: true });
    viewport.addEventListener('touchmove',  onPointerMove, { passive: true });
    viewport.addEventListener('touchend',   onPointerUp,   { passive: true });

    /* prevent img drag interference */
    track.querySelectorAll('img').forEach(function (img) {
      img.addEventListener('dragstart', preventDrag);
    });

    /* resize */
    window.addEventListener('resize', onResize);
  }

  /* ── Kick off once DOM is ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
