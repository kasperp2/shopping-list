<script lang="ts">
  // Translucent bottom toolbar: quick-add pills (or suggestions while typing)
  // above the "add item" field. Rides on top of the software keyboard.
  import { onMount } from 'svelte';
  import { nameKey, parseSummary } from '../lib/amount';
  import { haptic } from '../lib/spring';
  import { app } from '../lib/store/app.svelte';
  import { suggest } from '../lib/suggest';
  import Icon from './Icon.svelte';

  let { height = $bindable(0) }: { height?: number } = $props();

  let text = $state('');
  let input: HTMLInputElement;
  let keyboard = $state(0);
  let focused = $state(false);

  const parsed = $derived(parseSummary(text));
  const suggestions = $derived(text.trim() ? suggest(parsed.name, app.history) : []);
  const openAmounts = $derived(
    new Map(app.items.filter((i) => !i.completed).map((i) => [nameKey(i.name), i.amount])),
  );

  onMount(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const measure = () => (keyboard = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    // iOS fires the first resize as the keyboard starts to animate, often with
    // the old height, and nothing after it while the page can't scroll. So keep
    // measuring every frame for a moment after anything keyboard-related.
    let until = 0;
    let frame = 0;
    const tick = () => {
      measure();
      frame = performance.now() < until ? requestAnimationFrame(tick) : 0;
    };
    const update = () => {
      until = performance.now() + 700;
      if (!frame) frame = requestAnimationFrame(tick);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('focusin', update);
    window.addEventListener('focusout', update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('focusin', update);
      window.removeEventListener('focusout', update);
    };
  });

  // A tap on the field normally makes iOS scroll the whole (locked) page up to
  // keep the field clear of the keyboard, and the bar lifts itself as well, so
  // everything jumps. Focus it ourselves without that scroll instead.
  onMount(() => {
    const onTouchEnd = (e: TouchEvent) => {
      if (document.activeElement === input) return;
      e.preventDefault();
      input.focus({ preventScroll: true });
    };
    input.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => input.removeEventListener('touchend', onTouchEnd);
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!parsed.name) return;
    app.add(parsed.name, parsed.amount);
    text = '';
    input.focus();
  }

  function pick(name: string) {
    app.add(name, parsed.amount);
    text = '';
    input.focus();
  }

  // ---- quick-add: tap, long-press menu, drag to reorder ----

  let menu = $state<{ index: number; left: number; bottom: number } | null>(null);
  let reordering = $state(false);
  let scroller = $state<HTMLDivElement>();
  let press: { timer: ReturnType<typeof setTimeout>; x: number; y: number; fired: boolean } | null = null;
  let drag = $state<{ index: number; grab: number; x: number; id: number } | null>(null);

  function pillDown(e: PointerEvent, index: number) {
    const el = e.currentTarget as HTMLElement;
    if (reordering) {
      el.setPointerCapture(e.pointerId);
      const rect = el.getBoundingClientRect();
      drag = { index, grab: e.clientX - rect.left, x: 0, id: e.pointerId };
      return;
    }
    const timer = setTimeout(() => {
      if (!press) return;
      press.fired = true;
      haptic();
      const rect = el.getBoundingClientRect();
      menu = {
        index,
        left: Math.min(window.innerWidth - 106, Math.max(106, rect.left + rect.width / 2)),
        bottom: window.innerHeight - rect.top + 8 };
    }, 450);
    press = { timer, x: e.clientX, y: e.clientY, fired: false };
  }

  function pillMove(e: PointerEvent) {
    if (press && !press.fired && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) {
      clearTimeout(press.timer);
      press = null;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const pills = Array.from(scroller!.querySelectorAll<HTMLElement>('[data-pill]'));
    const el = pills[drag.index];
    const left = e.clientX - drag.grab;
    // layout position, ignoring our own transform
    const home = el.getBoundingClientRect().left - drag.x;
    drag.x = left - home;
    const center = left + el.offsetWidth / 2;
    const prev = pills[drag.index - 1];
    const next = pills[drag.index + 1];
    if (next && center > next.getBoundingClientRect().left + next.offsetWidth / 2) {
      app.moveQuick(drag.index, drag.index + 1);
      drag.x -= next.offsetWidth + 8;
      drag.index++;
    } else if (prev && center < prev.getBoundingClientRect().left + prev.offsetWidth / 2) {
      app.moveQuick(drag.index, drag.index - 1);
      drag.x += prev.offsetWidth + 8;
      drag.index--;
    }
  }

  function pillUp(e: PointerEvent, name: string) {
    if (drag && e.pointerId === drag.id) {
      drag = null;
      return;
    }
    if (!press) return;
    clearTimeout(press.timer);
    const fired = press.fired;
    press = null;
    if (fired || reordering || e.type === 'pointercancel') return;
    haptic();
    app.add(name);
  }
</script>

<div
  class="bar"
  bind:offsetHeight={height}
  class:keyboard={keyboard > 40}
  style:transform={keyboard ? `translate3d(0, ${-keyboard}px, 0)` : undefined}
>
  {#if text.trim() && suggestions.length}
    <div class="chips" role="listbox" aria-label="Forslag">
      {#each suggestions as s (s.key)}
        <button class="chip" role="option" aria-selected="false" onpointerdown={(e) => e.preventDefault()} onclick={() => pick(s.name)}>
          {s.name}
          {#if openAmounts.has(s.key)}<span class="on">×{openAmounts.get(s.key)}</span>{/if}
        </button>
      {/each}
    </div>
  {:else if app.quickButtons.length && !(focused && text)}
    <div class="chips" class:reordering bind:this={scroller} aria-label="Hurtigknapper">
      {#each app.quickButtons as q, i (nameKey(q.name))}
        {@const n = openAmounts.get(nameKey(q.name))}
        <button
          class="chip quick"
          class:active={!!n}
          class:dragging={drag?.index === i}
          data-pill
          style:transform={drag?.index === i ? `translate3d(${drag.x}px,0,0) scale(1.06)` : undefined}
          onpointerdown={(e) => pillDown(e, i)}
          onpointermove={pillMove}
          onpointerup={(e) => pillUp(e, q.name)}
          onpointercancel={(e) => pillUp(e, q.name)}
          oncontextmenu={(e) => e.preventDefault()}
          onkeydown={(e) => e.key === 'Enter' && app.add(q.name)}
          aria-label="Tilføj {q.name}{n ? `, ${n} på listen` : ''}"
        >
          {q.name}
          {#if n}<span class="badge">{n}</span>{/if}
        </button>
      {/each}
      {#if reordering}
        <button class="chip done" onclick={() => (reordering = false)}>Færdig</button>
      {/if}
    </div>
  {/if}

  <form class="add" onsubmit={submit}>
    <label class="input">
      <Icon name="plus" size={20} stroke={2.4} />
      <input
        bind:this={input}
        bind:value={text}
        onfocus={() => (focused = true)}
        onblur={() => (focused = false)}
        placeholder="Tilføj vare"
        enterkeyhint="enter"
        autocomplete="off"
        autocapitalize="sentences"
        aria-label="Tilføj vare"
      />
      {#if text}
        <button type="button" class="clear" aria-label="Ryd" onclick={() => ((text = ''), input.focus())}>
          <Icon name="xmark" size={14} stroke={2.6} />
        </button>
      {/if}
    </label>
    {#if text.trim()}
      <button class="send" type="submit" aria-label="Tilføj">
        {#if parsed.amount > 1}<span class="send-amount">{parsed.amount}</span>{/if}
        <Icon name="check" size={20} stroke={2.6} />
      </button>
    {/if}
  </form>
</div>

{#if menu}
  {@const q = app.quickButtons[menu.index]}
  <button class="menu-scrim" aria-label="Luk menu" onclick={() => (menu = null)}></button>
  <div class="menu" role="menu" style:left="{menu.left}px" style:bottom="{menu.bottom}px">
    <button
      role="menuitem"
      onclick={() => {
        reordering = true;
        menu = null;
      }}
    >
      Flyt <Icon name="arrows" size={18} />
    </button>
    <button
      role="menuitem"
      class="danger"
      onclick={() => {
        if (q) app.removeQuick(q.name);
        menu = null;
      }}
    >
      Fjern <Icon name="trash" size={18} />
    </button>
  </div>
{/if}

<style>
  .bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    padding: 8px 0 calc(8px + var(--safe-bottom));
    background: var(--bar);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    border-top: 0.5px solid var(--separator);
    /* iOS reports the final keyboard height as soon as it starts sliding, so
       ease along with it (≈ the system keyboard curve) instead of jumping. */
    transition: transform 380ms cubic-bezier(0.19, 0.91, 0.38, 1);
  }
  @media (prefers-reduced-motion: reduce) {
    .bar {
      transition: none;
    }
  }
  .bar.keyboard {
    padding-bottom: 8px;
  }
  /* The bar's colour continues below it, so the strip between the field and
     the keyboard (and behind the keyboard's rounded top) matches the bar. */
  .bar::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    height: 100vh;
    background: var(--bar-solid);
  }
  .chips {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 0 var(--gutter) 8px;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
  }
  .chips::-webkit-scrollbar {
    display: none;
  }
  .chips.reordering {
    overflow-x: visible;
    flex-wrap: wrap;
  }
  .chip {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border-radius: 17px;
    background: var(--card);
    font-size: 15px;
    font-weight: 500;
    box-shadow: 0 0 0 0.5px var(--separator);
    transition:
      transform 120ms var(--ease-out),
      background-color 120ms;
  }
  .chip:active {
    transform: scale(0.95);
    background: var(--card-pressed);
  }
  .quick.active {
    background: var(--tint-soft);
    color: var(--tint);
    box-shadow: none;
  }
  .badge {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--tint);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    display: grid;
    place-items: center;
    font-variant-numeric: tabular-nums;
  }
  .on {
    color: var(--tint);
    font-size: 13px;
  }
  .reordering .quick {
    touch-action: none;
    animation: wiggle 260ms ease-in-out infinite alternate;
  }
  .reordering .quick:nth-child(2n) {
    animation-delay: -130ms;
  }
  .quick.dragging {
    animation: none;
    z-index: 2;
    position: relative;
    box-shadow: var(--shadow);
    transition: none;
  }
  .chip.done {
    background: var(--tint);
    color: #fff;
    box-shadow: none;
  }
  @keyframes wiggle {
    from {
      rotate: -1.5deg;
    }
    to {
      rotate: 1.5deg;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .reordering .quick {
      animation: none;
      outline: 1.5px dashed var(--label-3);
    }
  }
  .add {
    display: flex;
    gap: 8px;
    padding: 0 var(--gutter);
  }
  .input {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 10px 0 12px;
    border-radius: 20px;
    background: var(--fill);
    color: var(--label-2);
  }
  .input input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--label);
    padding: 0;
  }
  .input input::placeholder {
    color: var(--label-2);
  }
  .clear {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--label-3);
    color: var(--card);
    display: grid;
    place-items: center;
  }
  .send {
    flex: none;
    height: 40px;
    min-width: 40px;
    padding: 0 10px;
    border-radius: 20px;
    background: var(--tint);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-weight: 600;
    transition: transform 100ms var(--ease-out);
  }
  .send:active {
    transform: scale(0.92);
  }
  .menu-scrim {
    position: fixed;
    inset: 0;
    z-index: 30;
    width: 100%;
  }
  .menu {
    position: fixed;
    z-index: 31;
    translate: -50% 0;
    min-width: 180px;
    border-radius: 13px;
    background: var(--bar);
    backdrop-filter: saturate(180%) blur(30px);
    -webkit-backdrop-filter: saturate(180%) blur(30px);
    box-shadow: var(--shadow);
    overflow: hidden;
    transform-origin: bottom center;
    animation: pop 220ms var(--ease-out);
  }
  .menu button {
    display: flex;
    width: 100%;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
  }
  .menu button + button {
    border-top: 0.5px solid var(--separator);
  }
  .menu button:active {
    background: var(--fill);
  }
  .menu .danger {
    color: var(--red);
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .menu {
      animation: none;
    }
  }
  @media (min-width: 720px) {
    .chips,
    .add {
      max-width: 720px;
      margin-inline: auto;
    }
  }
</style>
