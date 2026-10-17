<script lang="ts">
  // Bottom sheet: springs up from the bottom edge, follows the finger 1:1 when
  // dragged, and a flick down (projected momentum) dismisses it. Grabbing it
  // mid-animation picks it up from where it is on screen.
  import { onMount, type Snippet } from 'svelte';
  import { project, reducedMotion, rubberband, spring, VelocityTracker } from '../lib/spring';

  let {
    onclose,
    label,
    header,
    children,
  }: {
    onclose: () => void;
    label: string;
    header?: Snippet<[{ close: () => void }]>;
    children: Snippet<[{ close: () => void }]>;
  } = $props();

  let panel: HTMLDivElement;
  let height = $state(600);
  let y = $state(1000);
  let stop: () => void = () => {};
  let closing = false;
  let drag: { startY: number; startOffset: number; id: number; active: boolean } | null = null;
  const tracker = new VelocityTracker();

  const progress = $derived(Math.max(0, Math.min(1, 1 - y / height)));

  function animateTo(target: number, velocity = 0, done?: () => void) {
    stop();
    stop = spring({
      from: y,
      to: target,
      velocity,
      response: target === 0 ? 0.35 : 0.3,
      dampingRatio: target === 0 && Math.abs(velocity) > 300 ? 0.85 : 1,
      onUpdate: (v) => (y = v),
      onComplete: done,
    });
  }

  export function close() {
    if (closing) return;
    closing = true;
    animateTo(height + 40, 0, onclose);
  }

  onMount(() => {
    height = panel.offsetHeight;
    y = height;
    animateTo(0);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      stop();
      window.removeEventListener('keydown', onKey);
    };
  });

  function down(e: PointerEvent) {
    if (closing || e.button > 0) return;
    drag = { startY: e.clientY, startOffset: y, id: e.pointerId, active: false };
    tracker.reset();
    tracker.add(0, e.clientY);
    // Mid-animation: grab it right away. At rest: wait for movement so taps on
    // header buttons still click.
    if (Math.abs(y) > 0.5) begin(e);
  }

  function begin(e: PointerEvent) {
    if (!drag) return;
    stop();
    drag.active = true;
    drag.startOffset = y;
    drag.startY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    tracker.add(0, e.clientY);
    if (!drag.active) {
      if (Math.abs(e.clientY - drag.startY) < 6) return;
      begin(e);
    }
    const raw = drag.startOffset + (e.clientY - drag.startY);
    y = raw < 0 ? rubberband(raw, height) : raw;
  }

  function up(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const wasActive = drag.active;
    drag = null;
    if (!wasActive) return;
    const v = tracker.get().y;
    const rest = y + project(v, 0.99);
    if (rest > height * 0.45 || v > 900) {
      closing = true;
      animateTo(height + 40, v, onclose);
    } else animateTo(0, v);
  }
</script>

<div class="root" role="presentation">
  <button
    class="scrim"
    style:opacity={progress}
    aria-label="Luk"
    tabindex="-1"
    onclick={close}
  ></button>
  <div
    class="panel sheet-card"
    class:fade={reducedMotion()}
    bind:this={panel}
    role="dialog"
    aria-modal="true"
    aria-label={label}
    style:transform="translate3d(0, {y}px, 0)"
  >
    <div
      class="grab"
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
      role="presentation"
    >
      <span class="handle"></span>
      {#if header}
        <div class="header">{@render header({ close })}</div>
      {/if}
    </div>
    <div class="content">
      {@render children({ close })}
    </div>
  </div>
</div>

<style>
  .root {
    position: fixed;
    inset: 0;
    z-index: 50;
  }
  .scrim {
    position: absolute;
    inset: 0;
    width: 100%;
    background: var(--scrim);
    touch-action: none;
  }
  .panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: calc(100dvh - var(--safe-top) - 24px);
    display: flex;
    flex-direction: column;
    background: var(--sheet);
    border-radius: 14px 14px 0 0;
    box-shadow: var(--shadow);
    will-change: transform;
    padding-bottom: var(--safe-bottom);
  }
  /* the sheet's own background extends past the bottom so overshoot never shows a gap */
  .panel::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    height: 200px;
    background: var(--sheet);
  }
  .grab {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 0 10px;
    touch-action: none;
    cursor: grab;
    flex: none;
  }
  .header {
    align-self: stretch;
    padding: 4px 16px 0;
  }
  .handle {
    width: 36px;
    height: 5px;
    border-radius: 3px;
    background: var(--label-3);
  }
  .content {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: 16px;
  }
  @media (min-width: 600px) {
    .panel {
      left: 50%;
      width: 560px;
      margin-left: -280px;
    }
  }
</style>
