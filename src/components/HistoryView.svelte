<script lang="ts">
  import { nameKey } from '../lib/amount';
  import { haptic } from '../lib/spring';
  import { app } from '../lib/store/app.svelte';
  import Icon from './Icon.svelte';
  import Page from './Page.svelte';
  import SwipeRow from './SwipeRow.svelte';

  let { onback }: { onback: () => void } = $props();
  let query = $state('');

  const dateFmt = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' });
  const yearFmt = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });

  function when(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (days < 1 && new Date().getDate() === d.getDate()) return 'I dag';
    if (days < 2) return 'I går';
    return (d.getFullYear() === new Date().getFullYear() ? dateFmt : yearFmt).format(d);
  }

  function readd(entry: { name: string; key: string }) {
    const wasOpen = openKeys.has(entry.key);
    app.add(entry.name);
    if (!wasOpen) app.showToast(`${entry.name} tilføjet`);
  }

  const openKeys = $derived(new Set(app.items.filter((i) => !i.completed).map((i) => nameKey(i.name))));
  const entries = $derived(
    app.history
      .filter((h) => h.completed.length)
      .filter((h) => !query.trim() || h.key.includes(nameKey(query)))
      .map((h) => ({
        ...h,
        lastBought: h.completed.reduce((m, i) => ((i.completedAt ?? '') > m ? (i.completedAt ?? '') : m), ''),
      }))
      .sort((a, b) => b.lastBought.localeCompare(a.lastBought)),
  );
</script>

<Page title="Tidligere varer" back={app.currentList?.name ?? 'Liste'} {onback}>
  <div class="search">
    <Icon name="search" size={17} />
    <input bind:value={query} placeholder="Søg" type="search" enterkeyhint="search" aria-label="Søg i tidligere varer" />
  </div>

  {#if entries.length}
    <div class="group">
      <div class="card">
        {#each entries as entry (entry.key)}
          <SwipeRow
            ondelete={() => app.removeFromHistory(entry)}
            leading={{ label: 'Tilføj', icon: 'plus', color: 'var(--tint)', run: () => readd(entry) }}
          >
            <button
              class="cell"
              onclick={() => {
                haptic();
                readd(entry);
              }}
            >
              <span class="grow">
                <span class="name">{entry.name}</span>
                <span class="meta">
                  {[when(entry.lastBought), entry.count > 1 ? `${entry.count} gange` : '', entry.category].filter(Boolean).join(' · ')}
                </span>
              </span>
              {#if openKeys.has(entry.key)}
                <span class="on">På listen</span>
              {:else}
                <span class="add" aria-label="Tilføj"><Icon name="plus" size={18} stroke={2.6} /></span>
              {/if}
            </button>
          </SwipeRow>
        {/each}
      </div>
      <p class="group-footer">Tryk eller stryg til højre for at tilføje igen. Stryg til venstre for at slette varen fra historikken.</p>
    </div>
  {:else}
    <p class="empty">{query ? 'Ingen fund' : 'Afkrydsede varer vises her'}</p>
  {/if}
</Page>

<style>
  .search {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 var(--gutter) 20px;
    height: 36px;
    padding: 0 8px;
    border-radius: 10px;
    background: var(--fill);
    color: var(--label-2);
  }
  .search input {
    flex: 1;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--label);
    -webkit-appearance: none;
    appearance: none;
  }
  .grow {
    display: flex;
    flex-direction: column;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    font-size: 13px;
    color: var(--label-2);
    margin-top: 1px;
  }
  .on {
    font-size: 13px;
    color: var(--label-2);
  }
  .add {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--tint-soft);
    color: var(--tint);
    display: grid;
    place-items: center;
  }
  .empty {
    text-align: center;
    color: var(--label-2);
    margin-top: 80px;
  }
  .card :global(.wrap + .wrap .cell::before) {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    left: 16px;
    height: 0.5px;
    background: var(--separator);
  }
</style>
