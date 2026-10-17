<script lang="ts">
  // A pushed screen: slides in from the right and leaves the same way,
  // with an iOS large title that collapses into the nav bar on scroll.
  import type { Snippet } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { reducedMotion } from '../lib/spring';
  import Icon from './Icon.svelte';

  let {
    title,
    back,
    onback,
    trailing,
    children,
  }: { title: string; back: string; onback: () => void; trailing?: Snippet; children: Snippet } = $props();

  let collapsed = $state(false);

  function push(_node: Element) {
    if (reducedMotion()) return { duration: 180, css: (t: number) => `opacity:${t}` };
    return {
      duration: 380,
      easing: cubicOut,
      css: (t: number) => `transform: translate3d(${(1 - t) * 100}%,0,0); box-shadow: -8px 0 24px rgba(0,0,0,${0.12 * t})`,
    };
  }

</script>

<section class="page" transition:push aria-label={title} onscroll={(e) => (collapsed = e.currentTarget.scrollTop > 36)}>
  <header class="nav" class:collapsed>
    <button class="back" onclick={onback}>
      <Icon name="chevron-left" size={24} stroke={2.4} />
      <span>{back}</span>
    </button>
    <span class="small-title" aria-hidden={!collapsed}>{title}</span>
    <span class="trailing">{@render trailing?.()}</span>
  </header>
  <h1>{title}</h1>
  {@render children()}
</section>

<style>
  .page {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: var(--bg);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: calc(24px + var(--safe-bottom));
  }
  .nav {
    position: sticky;
    top: 0;
    z-index: 5;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: calc(44px + var(--safe-top));
    padding: var(--safe-top) 8px 0;
    background: transparent;
    border-bottom: 0.5px solid transparent;
    transition:
      background-color 200ms,
      border-color 200ms;
  }
  .nav.collapsed {
    background: var(--bar);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    border-bottom-color: var(--separator);
  }
  .back {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    color: var(--tint);
    padding: 8px 8px 8px 0;
    transition: opacity 100ms;
  }
  .back:active {
    opacity: 0.4;
  }
  .small-title {
    font-weight: 600;
    opacity: 0;
    transition: opacity 200ms;
  }
  .collapsed .small-title {
    opacity: 1;
  }
  .trailing {
    justify-self: end;
    padding-right: 8px;
  }
  h1 {
    margin: 2px var(--gutter) 12px;
    font-size: 34px;
    line-height: 41px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }
</style>
