<script lang="ts" module>
  // Only one row is swiped open at a time, like iOS.
  let openRow = $state<symbol | null>(null);
</script>

<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { project, rubberband, spring, VelocityTracker } from '../lib/spring';

  let {
    ondelete,
    label = 'Slet',
    children,
  }: { ondelete: () => void; label?: string; children: Snippet } = $props();

  const ACTION_W = 84;
  const id = Symbol();
  let x = $state(0);
  let width = $state(360);
  let el: HTMLDivElement;
  let stop: () => void = () => {};
  let gesture: { x0: number; y0: number; start: number; id: number; mode: 'pending' | 'swipe' | 'scroll' } | null = null;
  let suppressClick = false;
  const tracker = new VelocityTracker();

  const fullSwipe = $derived(-x > width * 0.6);

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
    x = raw > 0 ? rubberband(raw, width) : raw;
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
  .front {
    position: relative;
    background: var(--card);
    will-change: transform;
  }
</style>
