<script lang="ts" module>
  // Only one row is swiped open at a time, like iOS.
  let openRow = $state<symbol | null>(null);
</script>

<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { haptic, project, rubberband, spring, VelocityTracker } from '../lib/spring';
  import Icon, { type IconName } from './Icon.svelte';

  let {
    ondelete,
    label = 'Slet',
    leading,
    children,
  }: {
    ondelete: () => void;
    label?: string;
    /** Swipe right past the threshold to run this; the row springs back. */
    leading?: { label: string; icon: IconName; color: string; run: () => void };
    children: Snippet;
  } = $props();

  const ACTION_W = 84;
  const LEAD_AT = 88;
  const id = Symbol();
  let x = $state(0);
  let width = $state(360);
  let el: HTMLDivElement;
  let stop: () => void = () => {};
  let gesture: { x0: number; y0: number; start: number; id: number; mode: 'pending' | 'swipe' | 'scroll' } | null = null;
  let suppressClick = false;
  const tracker = new VelocityTracker();

  const fullSwipe = $derived(-x > width * 0.6);
  const armed = $derived(x > LEAD_AT);

  // A tick as the leading action arms or disarms, like Mail.
  let wasArmed = false;
  $effect(() => {
    const a = armed;
    if (gesture?.mode === 'swipe' && a !== wasArmed) haptic();
    wasArmed = a;
  });

  let deleting = false;

  // Another row was swiped open: close this one. Reacts to openRow only.
  $effect(() => {
    const open = openRow;
    untrack(() => {
      if (open !== id && x !== 0 && !gesture && !deleting) animateTo(0);
    });
  });

  function animateTo(target: number, velocity = 0, done?: () => void) {
    stop();
    stop = spring({ from: x, to: target, velocity, response: 0.3, onUpdate: (v) => (x = v), onComplete: done });
  }

  function commitDelete(velocity = 0) {
    deleting = true;
    width = el.offsetWidth;
    animateTo(-width - 20, Math.min(velocity, -1500), () => {
      ondelete();
      deleting = false;
      x = 0;
      if (openRow === id) openRow = null;
    });
  }

  function down(e: PointerEvent) {
    if (e.button > 0) return;
    width = el.offsetWidth;
    gesture = { x0: e.clientX, y0: e.clientY, start: x, id: e.pointerId, mode: 'pending' };
    tracker.reset();
    tracker.add(e.clientX, 0);
  }

  function move(e: PointerEvent) {
    if (!gesture || e.pointerId !== gesture.id) return;
    const dx = e.clientX - gesture.x0;
    const dy = e.clientY - gesture.y0;
    if (gesture.mode === 'pending') {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) gesture.mode = 'scroll';
      else if (Math.abs(dx) > 10) {
        gesture.mode = 'swipe';
        // start tracking from the slop boundary so the row doesn't jump
        gesture.x0 += Math.sign(dx) * 10;
        gesture.start = x;
        stop();
        openRow = id;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    }
    if (gesture.mode !== 'swipe') return;
    tracker.add(e.clientX, 0);
    const raw = gesture.start + (e.clientX - gesture.x0);
    if (raw <= 0) x = raw;
    else if (leading) x = raw > width * 0.7 ? width * 0.7 + rubberband(raw - width * 0.7, width) : raw;
    else x = rubberband(raw, width);
  }

  function up(e: PointerEvent) {
    if (!gesture || e.pointerId !== gesture.id) return;
    const mode = gesture.mode;
    gesture = null;
    if (mode !== 'swipe') return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    const v = tracker.get().x;
    const rest = x + project(v, 0.99);
    if (x > 0) {
      if (leading && (x > LEAD_AT || (rest > width * 0.5 && v > 600))) {
        if (x <= LEAD_AT) haptic();
        leading.run();
      }
      animateTo(0, v);
      if (openRow === id) openRow = null;
      return;
    }
    if (-x > width * 0.6 || (rest < -width * 0.75 && v < -600)) commitDelete(v);
    else if (rest < -ACTION_W / 2) animateTo(-ACTION_W, v);
    else {
      animateTo(0, v);
      if (openRow === id) openRow = null;
    }
  }

  function clickCapture(e: MouseEvent) {
    // A swipe or a tap on an open row closes it instead of activating the row.
    if (suppressClick || x < -1) {
      e.stopPropagation();
      e.preventDefault();
      if (!suppressClick) {
        animateTo(0);
        openRow = null;
      }
    }
  }
</script>

<div class="wrap" bind:this={el}>
  {#if leading}
    <div
      class="lead"
      style:background={leading.color}
      style:width="{Math.max(0, x)}px"
      style:visibility={x > 0.5 ? 'visible' : 'hidden'}
      aria-hidden="true"
    >
      <span class="lead-icon" class:armed><Icon name={leading.icon} size={22} stroke={2.6} /></span>
      <span class="sr-only">{leading.label}</span>
    </div>
  {/if}
  <button
    class="action"
    style:width="{Math.max(ACTION_W, -x)}px"
    style:visibility={x < -0.5 ? 'visible' : 'hidden'}
    tabindex={x < -1 ? 0 : -1}
    onclick={() => commitDelete()}
  >
    <span class="action-label" class:full={fullSwipe}>{label}</span>
  </button>
  <div
    class="front"
    style:transform="translate3d({x}px, 0, 0)"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    onclickcapture={clickCapture}
    role="presentation"
  >
    {@render children()}
  </div>
</div>

<style>
  .wrap {
    position: relative;
    overflow: hidden;
    touch-action: pan-y;
  }
  .action {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    background: var(--red);
    color: #fff;
    font-size: 15px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }
  .action-label {
    width: 84px;
    text-align: center;
    transition: transform 200ms var(--ease-out);
  }
  .lead {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    overflow: hidden;
  }
  .lead-icon {
    flex: none;
    width: 64px;
    display: grid;
    place-items: center;
    opacity: 0.6;
    transform: scale(0.8);
    transition:
      transform 200ms var(--ease-out),
      opacity 200ms;
  }
  .lead-icon.armed {
    opacity: 1;
    transform: scale(1);
  }
  .front {
    position: relative;
    background: var(--card);
    will-change: transform;
  }
</style>
