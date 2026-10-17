<script lang="ts">
  import { haptic } from '../lib/spring';
  import { app } from '../lib/store/app.svelte';
  import type { Item } from '../lib/types';
  import Icon from './Icon.svelte';
  import SwipeRow from './SwipeRow.svelte';

  let { item, onmenu }: { item: Item; onmenu: (item: Item) => void } = $props();

  function toggle() {
    if (!item.completed) haptic();
    app.toggle(item.uid);
  }
</script>

<SwipeRow
  ondelete={() => app.remove(item.uid)}
  leading={{
    label: item.completed ? 'Fjern flueben' : 'Sæt flueben',
    icon: item.completed ? 'xmark' : 'check',
    color: item.completed ? '#8e8e93' : 'var(--green)',
    run: () => app.toggle(item.uid),
  }}
>
  <div class="row" class:done={item.completed}>
    <button
      class="main"
      onclick={toggle}
      aria-pressed={item.completed}
      aria-label="{item.completed ? 'Fjern flueben fra' : 'Sæt flueben ved'} {item.name}"
    >
      <span class="check" aria-hidden="true">
        {#if item.completed}<Icon name="check" size={14} stroke={3} />{/if}
      </span>
      <span class="text">
        <span class="name">{item.name}</span>
        {#if item.note}<span class="note">{item.note}</span>{/if}
      </span>
      {#if item.amount > 1}
        <span class="amount" aria-label="{item.amount} stk">×{item.amount}</span>
      {/if}
    </button>
    <button class="more" onclick={() => onmenu(item)} aria-label="Flere valg for {item.name}">
      <Icon name="ellipsis" size={20} />
    </button>
  </div>
</SwipeRow>

<style>
  .row {
    display: flex;
    align-items: stretch;
    min-height: var(--row-h);
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0 8px 16px;
    text-align: left;
    transition: background-color 100ms;
  }
  .main:active {
    background: var(--card-pressed);
  }
  .check {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1.5px solid var(--label-3);
    display: grid;
    place-items: center;
    color: #fff;
    transition:
      background-color 160ms var(--ease-out),
      border-color 160ms var(--ease-out),
      transform 160ms var(--ease-out);
  }
  .main:active .check {
    transform: scale(0.9);
  }
  .done .check {
    background: var(--tint);
    border-color: var(--tint);
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 200ms;
  }
  .note {
    font-size: 15px;
    color: var(--label-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .done .name {
    color: var(--label-2);
    text-decoration: line-through;
    text-decoration-color: var(--label-3);
  }
  .amount {
    flex: none;
    min-width: 28px;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--tint-soft);
    color: var(--tint);
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .done .amount {
    background: var(--fill);
    color: var(--label-2);
  }
  .more {
    flex: none;
    width: 48px;
    display: grid;
    place-items: center;
    color: var(--label-2);
    transition: opacity 100ms;
  }
  .more:active {
    opacity: 0.4;
  }
</style>
