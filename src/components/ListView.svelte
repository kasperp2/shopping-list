<script lang="ts">
  import { flip } from 'svelte/animate';
  import { slide } from 'svelte/transition';
  import { reducedMotion } from '../lib/spring';
  import { app } from '../lib/store/app.svelte';
  import BottomBar from './BottomBar.svelte';
  import Icon from './Icon.svelte';
  import InstallHint from './InstallHint.svelte';
  import ItemMenuSheet from './ItemMenuSheet.svelte';
  import ItemRow from './ItemRow.svelte';
  import ListSheet from './ListSheet.svelte';

  let { onhistory, onsettings }: { onhistory: () => void; onsettings: () => void } = $props();

  let menuFor = $state<string | null>(null);
  let listsOpen = $state(false);
  let collapsed = $state(false);
  let barHeight = $state(110);

  const motion = reducedMotion() ? 0 : 1;
  const title = $derived(app.currentList?.name ?? 'Indkøb');

  $effect(() => {
    document.documentElement.style.setProperty('--bottom-bar', `${barHeight}px`);
  });

</script>

<main class="scroller" onscroll={(e) => (collapsed = e.currentTarget.scrollTop > 36)}>
<div class="list" style:padding-bottom="calc({barHeight + 16}px + var(--keyboard, 0px))">
  <header class="nav" class:collapsed>
    <span class="status">
      {#if !app.online}
        <span class="pill" title="Ændringer gemmes og sendes, når du er online igen">
          <Icon name="cloudoff" size={15} /> Offline{#if app.pending}&nbsp;· {app.pending}{/if}
        </span>
      {:else if app.syncing || app.pending}
        <span class="spinner" aria-label="Synkroniserer"></span>
      {/if}
    </span>
    <button class="small-title" onclick={() => (listsOpen = true)} tabindex={collapsed ? 0 : -1} aria-hidden={!collapsed}>
      {title}
      <Icon name="chevron-down" size={14} stroke={2.6} />
    </button>
    <span class="actions">
      <button class="icon-btn" onclick={onhistory} aria-label="Tidligere varer"><Icon name="clock" size={23} /></button>
      <button class="icon-btn" onclick={onsettings} aria-label="Indstillinger"><Icon name="gear" size={23} /></button>
    </span>
  </header>

  <button class="large-title" onclick={() => (listsOpen = true)} aria-label="Skift liste – {title}">
    <span>{title}</span>
    <span class="chev"><Icon name="chevron-down" size={20} stroke={2.6} /></span>
  </button>

  <InstallHint />

  {#if app.sections.length}
    {#each app.sections as section (section.key)}
      <section class="group" transition:slide={{ duration: 220 * motion }}>
        <h2 class="group-title">{section.title}</h2>
        <div class="card rows">
          {#each section.items as item (item.uid)}
            <div class="row-wrap" animate:flip={{ duration: 260 * motion }} transition:slide={{ duration: 200 * motion }}>
              <ItemRow {item} onmenu={(i) => (menuFor = i.uid)} />
            </div>
          {/each}
        </div>
      </section>
    {/each}
  {:else if app.loaded || !app.online}
    <div class="empty">
      <div class="empty-icon"><Icon name="check" size={34} stroke={2.2} /></div>
      <p class="empty-title">Listen er tom</p>
      <p class="empty-text">Skriv en vare nedenfor{app.quickButtons.length ? ' eller tryk på en hurtigknap' : ''}.</p>
    </div>
  {:else}
    <div class="empty"><span class="spinner big" aria-label="Henter"></span></div>
  {/if}
</div>
</main>

<BottomBar bind:height={barHeight} />

{#if menuFor}
  <ItemMenuSheet uid={menuFor} onclose={() => (menuFor = null)} />
{/if}
{#if listsOpen}
  <ListSheet onclose={() => (listsOpen = false)} />
{/if}

<style>
  .scroller {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .list {
    min-height: 100%;
    max-width: 720px;
    margin: 0 auto;
  }
  .nav {
    position: sticky;
    top: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: calc(44px + var(--safe-top));
    padding: var(--safe-top) 8px 0 var(--gutter);
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
  .status {
    justify-self: start;
    display: flex;
    align-items: center;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 12px;
    background: var(--fill);
    color: var(--label-2);
    font-size: 13px;
    font-weight: 500;
  }
  .small-title {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms;
    max-width: 50vw;
    white-space: nowrap;
    overflow: hidden;
  }
  .collapsed .small-title {
    opacity: 1;
    pointer-events: auto;
  }
  .actions {
    justify-self: end;
    display: flex;
  }
  .icon-btn {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    color: var(--tint);
    transition: opacity 100ms;
  }
  .icon-btn:active {
    opacity: 0.4;
  }
  .large-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 2px var(--gutter) 16px;
    max-width: calc(100% - 2 * var(--gutter));
    font-size: 34px;
    line-height: 41px;
    font-weight: 700;
    letter-spacing: -0.03em;
    text-align: left;
    transition: opacity 100ms;
  }
  .large-title span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .large-title:active {
    opacity: 0.5;
  }
  .chev {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--fill);
    color: var(--label-2);
    display: grid;
    place-items: center;
    margin-top: 4px;
  }
  .rows .row-wrap + .row-wrap {
    position: relative;
  }
  .rows .row-wrap + .row-wrap::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    left: 52px;
    height: 0.5px;
    background: var(--separator);
    z-index: 1;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 72px 32px;
    color: var(--label-2);
  }
  .empty-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--fill);
    display: grid;
    place-items: center;
    margin-bottom: 14px;
  }
  .empty-title {
    margin: 0 0 4px;
    font-size: 20px;
    font-weight: 600;
    color: var(--label);
  }
  .empty-text {
    margin: 0;
    font-size: 15px;
  }
  .spinner {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid var(--label-3);
    border-top-color: var(--label-2);
    animation: spin 0.8s linear infinite;
  }
  .spinner.big {
    width: 28px;
    height: 28px;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
