import { gsap } from 'gsap';

const PANEL_CONTENT = '.eyebrow, h1, h2, .splash-copy, .panel-copy, .record-grid > div, .control-copy, .panel-actions > button, .mode-button, .finish-time, .new-record';

export class MotionDirector {
  constructor({
    panels,
    huds,
    countdown,
    countdownValue,
    toast,
    touchJoystick,
    touchStick,
    touchHint,
    speedBars,
    buttons,
    debug = false,
  }) {
    this.panels = panels;
    this.huds = huds;
    this.countdown = countdown;
    this.countdownValue = countdownValue;
    this.toast = toast;
    this.touchJoystick = touchJoystick;
    this.touchStick = touchStick;
    this.touchHint = touchHint;
    this.debug = debug;
    this.currentPanel = null;
    this.panelTimeline = null;
    this.countdownTimeline = null;
    this.toastTimeline = null;
    this.lastCountdownDigit = null;
    this.lastShieldState = null;
    this.reducedMotion = false;

    this.media = gsap.matchMedia();
    this.media.add({
      reduced: '(prefers-reduced-motion: reduce)',
      full: '(prefers-reduced-motion: no-preference)',
    }, (context) => {
      this.reducedMotion = Boolean(context.conditions.reduced);
    });

    this.speedSetters = new Map();
    for (const bar of speedBars) {
      gsap.set(bar, { width: '100%', scaleX: 0, transformOrigin: 'left center' });
      this.speedSetters.set(bar, gsap.quickTo(bar, 'scaleX', {
        duration: this.time(0.16),
        ease: 'power2.out',
      }));
    }

    gsap.set(this.toast, { xPercent: -50, y: -12, scale: 0.94, autoAlpha: 0 });
    gsap.set(this.touchJoystick, { autoAlpha: 0, scale: 0.94, transformOrigin: '50% 50%' });
    gsap.set(this.touchHint, { xPercent: -50, autoAlpha: 0, y: 8 });
    gsap.set(this.countdown, { autoAlpha: 0 });
    this.setTouchStickX = gsap.quickSetter(this.touchStick, 'x', 'px');
    this.setTouchStickY = gsap.quickSetter(this.touchStick, 'y', 'px');

    for (const panel of panels) {
      const hidden = panel.classList.contains('is-hidden');
      panel.inert = hidden;
      panel.setAttribute('aria-hidden', String(hidden));
      if (hidden) gsap.set(panel, { autoAlpha: 0, pointerEvents: 'none' });
    }
    for (const hud of huds) {
      const hidden = hud.classList.contains('is-hidden');
      hud.inert = hidden;
      if (hidden) gsap.set(hud, { autoAlpha: 0, y: -10, pointerEvents: 'none' });
    }

    this.bindButtons(buttons);
  }

  time(seconds) {
    if (this.reducedMotion) return 0.01;
    if (this.debug) return Math.min(0.06, seconds * 0.18);
    return seconds;
  }

  hardHidePanel(panel) {
    if (!panel) return;
    panel.classList.add('is-hidden');
    panel.inert = true;
    panel.setAttribute('aria-hidden', 'true');
    gsap.set(panel, { autoAlpha: 0, pointerEvents: 'none', zIndex: 3 });
  }

  setPanel(nextPanel, { immediate = false, intro = false } = {}) {
    this.panelTimeline?.kill();
    this.panelTimeline = null;
    const previous = this.currentPanel;

    for (const panel of this.panels) {
      gsap.killTweensOf(panel);
      gsap.killTweensOf(panel.querySelectorAll(PANEL_CONTENT));
      if (panel !== previous && panel !== nextPanel) this.hardHidePanel(panel);
    }

    if (previous && previous !== nextPanel) {
      previous.inert = true;
      previous.setAttribute('aria-hidden', 'true');
      gsap.set(previous, { pointerEvents: 'none', zIndex: 3 });
    }

    if (nextPanel) {
      nextPanel.classList.remove('is-hidden');
      nextPanel.inert = false;
      nextPanel.setAttribute('aria-hidden', 'false');
      gsap.set(nextPanel, { pointerEvents: 'auto', zIndex: 4 });
    }
    this.currentPanel = nextPanel;

    if (immediate || this.reducedMotion) {
      if (previous && previous !== nextPanel) this.hardHidePanel(previous);
      if (nextPanel) {
        gsap.set(nextPanel, { autoAlpha: 1, scale: 1, zIndex: 3 });
        gsap.set(nextPanel.querySelectorAll(PANEL_CONTENT), { autoAlpha: 1, y: 0, scale: 1 });
      }
      return null;
    }

    const timeline = gsap.timeline({ defaults: { overwrite: 'auto' } });
    this.panelTimeline = timeline;
    if (previous && previous !== nextPanel) {
      timeline.to(previous, {
        autoAlpha: 0,
        scale: 1.012,
        duration: this.time(0.2),
        ease: 'power2.in',
      }, 0);
      timeline.call(() => this.hardHidePanel(previous), null, this.time(0.21));
    }

    if (nextPanel) {
      const content = nextPanel.querySelectorAll(PANEL_CONTENT);
      const orbit = nextPanel.querySelector('.splash-orbit');
      gsap.set(nextPanel, { autoAlpha: 0, scale: 1 });
      timeline.to(nextPanel, {
        autoAlpha: 1,
        duration: this.time(intro ? 0.5 : 0.3),
        ease: 'power2.out',
      }, previous && previous !== nextPanel ? this.time(0.08) : 0);
      timeline.fromTo(content, {
        autoAlpha: 0,
        y: this.reducedMotion ? 0 : 22,
        scale: this.reducedMotion ? 1 : 0.975,
      }, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: this.time(0.46),
        stagger: this.time(0.045),
        ease: 'power3.out',
      }, '<+0.02');
      if (orbit) {
        timeline.fromTo(orbit, {
          autoAlpha: 0,
          scale: this.reducedMotion ? 1 : 0.82,
          rotation: -28,
        }, {
          autoAlpha: 1,
          scale: 1,
          rotation: -18,
          duration: this.time(1.1),
          ease: 'power2.out',
        }, 0);
      }
      timeline.set(nextPanel, { zIndex: 3 });
    }
    return timeline;
  }

  showHud(targetHud) {
    for (const hud of this.huds) {
      if (hud !== targetHud) this.hideHud(hud, { immediate: true });
    }
    gsap.killTweensOf(targetHud);
    gsap.killTweensOf(targetHud.children);
    targetHud.classList.remove('is-hidden');
    targetHud.inert = false;
    gsap.set(targetHud, { pointerEvents: 'auto' });
    if (this.reducedMotion) {
      gsap.set(targetHud, { autoAlpha: 1, y: 0, scale: 1 });
      return;
    }
    const timeline = gsap.timeline({ defaults: { overwrite: 'auto' } });
    timeline.fromTo(targetHud, { autoAlpha: 0, y: -14, scale: 0.98 }, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: this.time(0.34),
      ease: 'power3.out',
    });
    timeline.fromTo(targetHud.children, { autoAlpha: 0, y: -5 }, {
      autoAlpha: 1,
      y: 0,
      duration: this.time(0.24),
      stagger: this.time(0.025),
      ease: 'power2.out',
    }, '<+0.05');
  }

  hideHud(hud, { immediate = false } = {}) {
    gsap.killTweensOf(hud);
    gsap.killTweensOf(hud.children);
    hud.inert = true;
    gsap.set(hud, { pointerEvents: 'none' });
    if (immediate || hud.classList.contains('is-hidden') || this.reducedMotion) {
      hud.classList.add('is-hidden');
      gsap.set(hud, { autoAlpha: 0, y: -10 });
      return;
    }
    gsap.to(hud, {
      autoAlpha: 0,
      y: -10,
      duration: this.time(0.18),
      ease: 'power2.in',
      overwrite: 'auto',
      onComplete: () => hud.classList.add('is-hidden'),
    });
  }

  hideAllHuds({ immediate = false } = {}) {
    for (const hud of this.huds) this.hideHud(hud, { immediate });
  }

  showCountdown(initialDigit = '3') {
    this.countdownTimeline?.kill();
    gsap.killTweensOf([this.countdown, this.countdownValue]);
    this.countdown.classList.remove('is-hidden');
    this.countdown.setAttribute('aria-hidden', 'false');
    gsap.set(this.countdown, { autoAlpha: 1 });
    this.lastCountdownDigit = null;
    this.setCountdownDigit(initialDigit);
  }

  setCountdownDigit(digit) {
    const value = String(digit);
    if (value === this.lastCountdownDigit) return;
    this.lastCountdownDigit = value;
    this.countdownValue.textContent = value;
    gsap.killTweensOf(this.countdownValue);
    if (this.reducedMotion) {
      gsap.set(this.countdownValue, { autoAlpha: 1, scale: 1, rotation: 0 });
      return;
    }
    gsap.fromTo(this.countdownValue, {
      autoAlpha: 0,
      scale: 1.65,
      rotation: -3,
    }, {
      autoAlpha: 1,
      scale: 1,
      rotation: 0,
      duration: this.time(0.5),
      ease: 'back.out(1.8)',
      overwrite: 'auto',
    });
  }

  hideCountdown() {
    this.countdownTimeline?.kill();
    gsap.killTweensOf([this.countdown, this.countdownValue]);
    this.countdownTimeline = gsap.timeline({
      onComplete: () => {
        this.countdown.classList.add('is-hidden');
        this.countdown.setAttribute('aria-hidden', 'true');
      },
    });
    this.countdownTimeline.to(this.countdownValue, {
      autoAlpha: 0,
      scale: this.reducedMotion ? 1 : 1.6,
      duration: this.time(0.16),
      ease: 'power2.in',
    }).to(this.countdown, { autoAlpha: 0, duration: this.time(0.08) }, '<');
  }

  showToast(message, hold = 1.25) {
    this.toastTimeline?.kill();
    gsap.killTweensOf(this.toast);
    this.toast.textContent = message;
    this.toast.classList.add('is-visible');
    gsap.set(this.toast, { xPercent: -50, y: -12, scale: 0.94, autoAlpha: 0 });
    this.toastTimeline = gsap.timeline({
      onComplete: () => this.toast.classList.remove('is-visible'),
    });
    this.toastTimeline.to(this.toast, {
      y: 0,
      scale: 1,
      autoAlpha: 1,
      duration: this.time(0.2),
      ease: 'back.out(1.7)',
    }).to(this.toast, {
      y: 8,
      scale: 0.98,
      autoAlpha: 0,
      duration: this.time(0.18),
      ease: 'power2.in',
    }, `>+=${this.debug ? 0.04 : hold}`);
  }

  setSpeed(bar, progress) {
    this.speedSetters.get(bar)?.(gsap.utils.clamp(0, 1, progress));
  }

  setShield(element, active) {
    if (active === this.lastShieldState) return;
    this.lastShieldState = active;
    element.classList.toggle('is-active', active);
    gsap.killTweensOf([element, element.querySelector('.shield-dot')]);
    gsap.to(element, {
      opacity: active ? 1 : 0.3,
      scale: active && !this.reducedMotion ? 1.08 : 1,
      duration: this.time(0.22),
      ease: 'power2.out',
      overwrite: 'auto',
      onComplete: () => gsap.to(element, { scale: 1, duration: this.time(0.16), ease: 'power2.out' }),
    });
    if (active) gsap.fromTo(element.querySelector('.shield-dot'), { scale: 0.6 }, { scale: 1.45, duration: this.time(0.2), repeat: 1, yoyo: true, ease: 'power2.out' });
  }

  pulse(target, { strength = 1.2, color = 'brightness(1.45) saturate(1.3)' } = {}) {
    if (!target) return;
    gsap.killTweensOf(target);
    const amount = this.reducedMotion ? 1 : strength;
    gsap.timeline()
      .to(target, { scale: amount, filter: color, duration: this.time(0.1), ease: 'power2.out', overwrite: 'auto' })
      .to(target, { scale: 1, filter: 'none', duration: this.time(0.24), ease: 'back.out(1.7)' });
  }

  showTouchJoystick(x, y) {
    gsap.killTweensOf(this.touchJoystick);
    gsap.set(this.touchJoystick, { left: x, top: y });
    gsap.to(this.touchJoystick, {
      autoAlpha: 0.72,
      scale: 1,
      duration: this.time(0.14),
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }

  moveTouchStick(x, y = 0) {
    this.setTouchStickX(x);
    this.setTouchStickY(y);
  }

  hideTouchJoystick() {
    gsap.killTweensOf([this.touchJoystick, this.touchStick]);
    gsap.to(this.touchStick, { x: 0, y: 0, duration: this.time(0.16), ease: 'power3.out', overwrite: 'auto' });
    gsap.to(this.touchJoystick, { autoAlpha: 0, scale: 0.94, duration: this.time(0.14), ease: 'power2.in', overwrite: 'auto' });
  }

  flashTouchJump() {
    gsap.killTweensOf(this.touchJoystick);
    gsap.timeline()
      .to(this.touchJoystick, { borderColor: 'rgba(255, 250, 240, .95)', scale: this.reducedMotion ? 1 : 1.08, duration: this.time(0.08) })
      .to(this.touchJoystick, { borderColor: 'rgba(255, 250, 240, .42)', scale: 1, duration: this.time(0.2), ease: 'power2.out' });
  }

  flashTouchBoost() {
    gsap.killTweensOf(this.touchJoystick);
    gsap.timeline()
      .to(this.touchJoystick, {
        borderColor: 'rgba(40, 238, 255, .98)',
        boxShadow: '0 0 30px rgba(255, 22, 141, .72)',
        y: this.reducedMotion ? 0 : -10,
        scale: this.reducedMotion ? 1 : 1.12,
        duration: this.time(0.1),
        ease: 'power3.out',
      })
      .to(this.touchJoystick, {
        borderColor: 'rgba(255, 250, 240, .42)',
        boxShadow: 'none',
        y: 0,
        scale: 1,
        duration: this.time(0.26),
        ease: 'back.out(1.7)',
      });
  }

  showTouchHint(message) {
    this.touchHint.textContent = message;
    gsap.killTweensOf(this.touchHint);
    gsap.fromTo(this.touchHint, {
      autoAlpha: 0,
      y: 8,
    }, {
      autoAlpha: 1,
      y: 0,
      duration: this.time(0.34),
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }

  hideTouchHint({ immediate = false } = {}) {
    gsap.killTweensOf(this.touchHint);
    if (immediate || this.reducedMotion) {
      gsap.set(this.touchHint, { autoAlpha: 0, y: 8 });
      return;
    }
    gsap.to(this.touchHint, {
      autoAlpha: 0,
      y: 8,
      duration: this.time(0.28),
      ease: 'power2.in',
      overwrite: 'auto',
    });
  }

  bindButtons(buttons) {
    for (const button of buttons) {
      gsap.set(button, { transformOrigin: '50% 50%' });
      const hoverIn = () => gsap.to(button, {
        filter: 'brightness(1.14) saturate(1.08)',
        duration: this.time(0.18),
        ease: 'power2.out',
        overwrite: 'auto',
      });
      const hoverOut = () => gsap.to(button, {
        y: 0,
        scale: 1,
        filter: 'none',
        duration: this.time(0.22),
        ease: 'power2.out',
        overwrite: 'auto',
      });
      button.addEventListener('pointerenter', hoverIn);
      button.addEventListener('pointerleave', hoverOut);
      button.addEventListener('focus', hoverIn);
      button.addEventListener('blur', hoverOut);
      button.addEventListener('pointerdown', () => gsap.to(button, {
        y: 1,
        scale: this.reducedMotion ? 1 : 0.97,
        duration: this.time(0.07),
        ease: 'power2.out',
        overwrite: 'auto',
      }));
      button.addEventListener('pointerup', () => gsap.to(button, {
        y: 0,
        scale: 1,
        filter: 'brightness(1.14) saturate(1.08)',
        duration: this.time(0.14),
        ease: 'power2.out',
        overwrite: 'auto',
      }));
      button.addEventListener('pointercancel', hoverOut);
    }
  }
}
