<script lang="ts">
  import { app } from '../lib/store/app.svelte';
  import Icon from './Icon.svelte';
  import Sheet from './Sheet.svelte';
  import SwipeRow from './SwipeRow.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let creating = $state(false);
  let name = $state('');
  let busy = $state(false);

  async function create(close: () => void) {
    if (!name.trim() || busy) return;
    busy = true;
    try {
      await app.createList(name);
      close();
    } catch {
      app.showToast('Kunne ikke oprette listen');
    } finally {
      busy = false;
    }
  }

  async function remove(url: string) {
    try {
      await app.deleteList(url);
    } catch {
      app.showToast('Kunne ikke slette listen');
    }
  }

  function focus(node: HTMLElement) {
    requestAnimationFrame(() => node.focus());
  }
</script>

<Sheet label="Lister" {onclose}>
  {#snippet header({ close })}
    <div class="head">
      <span></span>
      <h2>Lister</h2>
      <button class="text-btn ok" onclick={close}>OK</button>
    </div>
  {/snippet}
  {#snippet children({ close })}
    <div class="group">
      <div class="card">
        {#each app.lists as list (list.url)}
          <SwipeRow ondelete={() => remove(list.url)}>
            <button
              class="cell"
              onclick={() => {
                app.selectList(list.url);
                close();
              }}
            >
              <span class="dot" style:background={list.color || 'var(--tint)'}><Icon name="list" size={16} /></span>
              <span class="grow">{list.name}</span>
              {#if list.url === app.currentUrl}
                <span class="tick"><Icon name="check" size={18} stroke={2.6} /></span>
              {/if}
            </button>
          </SwipeRow>
        {/each}
        {#if creating}
          <form
            class="cell cell-sep"
            onsubmit={(e) => {
              e.preventDefault();
              void create(close);
            }}
          >
            <input class="field" bind:value={name} use:focus placeholder="Navn på liste" enterkeyhint="done" aria-label="Navn på ny liste" />
            <button class="text-btn" type="submit" disabled={!name.trim() || busy}>Opret</button>
          </form>
        {:else}
          <button class="cell cell-sep tinted" onclick={() => (creating = true)}>
            <span class="plus"><Icon name="plus" size={18} stroke={2.4} /></span>
            <span class="grow">Ny liste</span>
          </button>
        {/if}
      </div>
      <p class="group-footer">Stryg til venstre for at slette en liste. Kun lister helt uden varer – heller ikke tidligere varer – kan slettes.</p>
    </div>
  {/snippet}
</Sheet>

<style>
  .head {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    min-height: 36px;
  }
  h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
  }
  .ok {
    justify-self: end;
    font-weight: 600;
  }
  .dot {
    width: 29px;
    height: 29px;
    border-radius: 50%;
    color: #fff;
    display: grid;
    place-items: center;
    flex: none;
  }
  .plus {
    width: 29px;
    display: grid;
    place-items: center;
  }
  .tick {
    color: var(--tint);
    display: grid;
  }
  /* separators between swipe rows */
  .card :global(.wrap + .wrap .cell::before) {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    left: 57px;
    height: 0.5px;
    background: var(--separator);
  }
</style>
