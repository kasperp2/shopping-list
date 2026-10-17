<script lang="ts">
  import { FALLBACK_ID } from '../lib/categories';
  import { app } from '../lib/store/app.svelte';
  import Icon from './Icon.svelte';
  import Page from './Page.svelte';
  import SwipeRow from './SwipeRow.svelte';

  let { onback }: { onback: () => void } = $props();

  let editing = $state<string | null>(null);
  let draft = $state('');
  let adding = $state(false);
  let newName = $state('');
  let confirmLogout = $state(false);

  const server = $derived(app.config.proxy ? 'Via denne server' : (app.creds?.serverUrl ?? '').replace(/^https?:\/\//, ''));

  // ---- drag to reorder categories ----
  let list: HTMLDivElement;
  let drag = $state<{ index: number; y: number; grab: number; id: number } | null>(null);

  function down(e: PointerEvent, index: number) {
    e.stopPropagation(); // don't start a swipe-to-delete
    const row = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-row]')!;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { index, y: 0, grab: e.clientY - row.getBoundingClientRect().top, id: e.pointerId };
  }

  function move(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-row]'));
    const row = rows[drag.index];
    const top = e.clientY - drag.grab;
    const home = row.getBoundingClientRect().top - drag.y;
    drag.y = top - home;
    const center = top + row.offsetHeight / 2;
    const prev = rows[drag.index - 1];
    const next = rows[drag.index + 1];
    if (next && center > next.getBoundingClientRect().top + next.offsetHeight / 2) {
      app.moveCategory(drag.index, drag.index + 1);
      drag.y -= next.offsetHeight;
      drag.index++;
    } else if (prev && center < prev.getBoundingClientRect().top + prev.offsetHeight / 2) {
      app.moveCategory(drag.index, drag.index - 1);
      drag.y += prev.offsetHeight;
      drag.index--;
    }
  }

  function up(e: PointerEvent) {
    if (drag && e.pointerId === drag.id) drag = null;
  }

  function focus(node: HTMLElement) {
    requestAnimationFrame(() => node.focus());
  }
</script>

<Page title="Indstillinger" back={app.currentList?.name ?? 'Liste'} {onback}>
  <div class="group">
    <h2 class="group-title">Konto</h2>
    <div class="card">
      <div class="cell">
        <span class="grow">Server</span>
        <span class="trail ellip">{server}</span>
      </div>
      <div class="cell">
        <span class="grow">Bruger</span>
        <span class="trail">{app.creds?.username}</span>
      </div>
      <div class="cell">
        <span class="grow">Status</span>
        <span class="trail">
          {#if !app.online}Offline{:else if app.pending}Synkroniserer {app.pending}…{:else}Synkroniseret{/if}
        </span>
      </div>
    </div>
  </div>

  <div class="group">
    <h2 class="group-title">Hurtigknapper · {app.currentList?.name}</h2>
    <div class="card">
      {#each app.quickButtons as q (q.name)}
        <SwipeRow ondelete={() => app.removeQuick(q.name)} label="Fjern">
          <div class="cell">
            <span class="bolt"><Icon name="bolt" size={16} /></span>
            <span class="grow">{q.name}</span>
          </div>
        </SwipeRow>
      {:else}
        <div class="cell"><span class="grow muted">Ingen hurtigknapper endnu</span></div>
      {/each}
    </div>
    <p class="group-footer">Opret en hurtigknap fra ⋯ ved en vare. Hold en knap nede i bunden af listen for at flytte eller fjerne den.</p>
  </div>

  <div class="group">
    <h2 class="group-title">Kategorier</h2>
    <div class="card" bind:this={list}>
      {#each app.categories as cat, i (cat.id)}
        <div
          data-row
          class="row"
          class:dragging={drag?.index === i}
          style:transform={drag?.index === i ? `translate3d(0,${drag.y}px,0)` : undefined}
        >
          <SwipeRow ondelete={() => app.removeCategory(cat.id)}>
            {#if editing === cat.id}
              <form
                class="cell"
                onsubmit={(e) => {
                  e.preventDefault();
                  app.renameCategory(cat.id, draft);
                  editing = null;
                }}
              >
                <input class="field" bind:value={draft} use:focus onblur={() => (editing = null)} enterkeyhint="done" aria-label="Navn på kategori" />
              </form>
            {:else}
              <div class="cell">
                <button
                  class="grow name"
                  onclick={() => {
                    editing = cat.id;
                    draft = cat.name;
                  }}
                >
                  {cat.name}
                </button>
                {#if cat.id !== FALLBACK_ID}
                  <span
                    class="handle"
                    role="button"
                    tabindex="-1"
                    aria-label="Flyt {cat.name}"
                    onpointerdown={(e) => down(e, i)}
                    onpointermove={move}
                    onpointerup={up}
                    onpointercancel={up}
                  >
                    <Icon name="grip" size={20} />
                  </span>
                {/if}
              </div>
            {/if}
          </SwipeRow>
        </div>
      {/each}
      {#if adding}
        <form
          class="cell cell-sep"
          onsubmit={(e) => {
            e.preventDefault();
            app.addCategory(newName);
            newName = '';
            adding = false;
          }}
        >
          <input class="field" bind:value={newName} use:focus placeholder="Ny kategori" enterkeyhint="done" aria-label="Ny kategori" />
          <button class="text-btn" type="submit" disabled={!newName.trim()}>Tilføj</button>
        </form>
      {:else}
        <button class="cell cell-sep tinted" onclick={() => (adding = true)}>
          <span class="grow">Tilføj kategori</span>
        </button>
      {/if}
    </div>
    <p class="group-footer">
      Træk i <Icon name="grip" size={12} /> for at sortere i den rækkefølge, du går gennem butikken. Tryk på et navn for at omdøbe.
    </p>
  </div>

  <div class="group">
    <div class="card">
      <button class="cell tinted" onclick={() => app.resetCategories()}>
        <span class="grow">Gendan standardkategorier</span>
      </button>
    </div>
  </div>

  <div class="group">
    <div class="card">
      {#if confirmLogout}
        <button class="cell destructive" onclick={() => app.logout()}>
          <span class="grow center">Log ud og glem data på denne enhed</span>
        </button>
        <button class="cell" onclick={() => (confirmLogout = false)}>
          <span class="grow center">Annuller</span>
        </button>
      {:else}
        <button class="cell destructive" onclick={() => (confirmLogout = true)}>
          <span class="grow center">Log ud</span>
        </button>
      {/if}
    </div>
    <p class="group-footer">Listerne bliver på serveren. Hurtigknapper og kategorier på denne enhed nulstilles.</p>
  </div>
</Page>

<style>
  .ellip {
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .muted {
    color: var(--label-2);
  }
  .bolt {
    color: var(--orange);
    display: grid;
  }
  .name {
    text-align: left;
    padding: 2px 0;
  }
  .handle {
    color: var(--label-3);
    padding: 10px 4px 10px 16px;
    margin: -10px -4px -10px 0;
    touch-action: none;
    cursor: grab;
    display: grid;
  }
  .row {
    position: relative;
    background: var(--card);
  }
  .row + .row :global(.cell)::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    left: 16px;
    height: 0.5px;
    background: var(--separator);
  }
  .row.dragging {
    z-index: 2;
    box-shadow: var(--shadow);
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
  .center {
    text-align: center;
  }
  .group-footer :global(svg) {
    vertical-align: -1px;
  }
</style>
