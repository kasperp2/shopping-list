<script lang="ts">
  import { app } from '../lib/store/app.svelte';
  import { findCategory } from '../lib/categories';
  import { tidyName } from '../lib/amount';
  import type { Item } from '../lib/types';
  import Icon from './Icon.svelte';
  import Sheet from './Sheet.svelte';

  let { uid, onclose }: { uid: string; onclose: () => void } = $props();

  type Page = 'main' | 'category' | 'rename' | 'note';
  let page = $state<Page>('main');
  let draft = $state('');

  // Follow live state so +/− and edits from others show immediately.
  const item = $derived<Item | undefined>(app.items.find((i) => i.uid === uid));
  const currentCat = $derived(item ? findCategory(app.categories, item.category) : undefined);
  const isQuick = $derived(item ? app.hasQuick(item.name) : false);

  $effect(() => {
    if (!item) onclose();
  });

  function open(p: Page) {
    if (!item) return;
    draft = p === 'rename' ? item.name : p === 'note' ? item.note : '';
    page = p;
  }

  function saveRename() {
    if (!item) return;
    const name = tidyName(draft);
    if (name && name !== item.name) {
      const wasQuick = app.hasQuick(item.name);
      app.update(uid, { name });
      if (wasQuick) {
        app.removeQuick(item.name);
        app.addQuick(name);
      }
    }
    page = 'main';
  }

  function saveNote() {
    if (item && draft.trim() !== item.note) app.update(uid, { note: draft.trim() });
    page = 'main';
  }

  function focus(node: HTMLElement) {
    // let the page swap paint before the keyboard comes up
    requestAnimationFrame(() => node.focus());
  }
</script>

{#if item}
  <Sheet label="Valg for {item.name}" {onclose}>
    {#snippet header({ close })}
      <div class="head">
        {#if page === 'main'}
          <span class="spacer"></span>
          <h2>{item.name}</h2>
          <button class="text-btn done" onclick={close}>OK</button>
        {:else}
          <button class="text-btn back" onclick={() => (page = 'main')}>
            <Icon name="chevron-left" size={20} /> Tilbage
          </button>
          <h2>
            {page === 'category' ? 'Kategori' : page === 'rename' ? 'Omdøb' : 'Note'}
          </h2>
          {#if page === 'rename'}
            <button class="text-btn done" onclick={() => saveRename()} disabled={!draft.trim()}>Gem</button>
          {:else if page === 'note'}
            <button class="text-btn done" onclick={saveNote}>Gem</button>
          {:else}
            <span class="spacer"></span>
          {/if}
        {/if}
      </div>
    {/snippet}

    {#snippet children({ close })}
      {#if page === 'main'}
        <div class="stepper" role="group" aria-label="Antal">
          <button
            class="step"
            onclick={() => app.changeAmount(uid, -1)}
            disabled={item.amount <= 1}
            aria-label="Færre"
          >
            <Icon name="minus" size={26} stroke={2.4} />
          </button>
          <div class="count" aria-live="polite">
            <span class="num">{item.amount}</span>
            <span class="unit">stk</span>
          </div>
          <button class="step" onclick={() => app.changeAmount(uid, 1)} disabled={item.amount >= 99} aria-label="Flere">
            <Icon name="plus" size={26} stroke={2.4} />
          </button>
        </div>

        <div class="group">
          <div class="card">
            <button
              class="cell"
              onclick={() => {
                if (isQuick) app.removeQuick(item.name);
                else {
                  app.addQuick(item.name);
                  app.showToast(`Hurtigknap oprettet: ${item.name}`);
                }
              }}
            >
              <span class="ic" style:background="var(--orange)"><Icon name="bolt" size={17} /></span>
              <span class="grow">{isQuick ? 'Fjern hurtigknap' : 'Opret hurtigknap'}</span>
            </button>
            <button class="cell" onclick={() => open('category')}>
              <span class="ic" style:background="var(--green)"><Icon name="tag" size={17} /></span>
              <span class="grow">Kategori</span>
              <span class="trail">{currentCat?.name ?? (item.category || 'Andet')}</span>
              <span class="trail chev"><Icon name="chevron-right" size={16} /></span>
            </button>
            <button class="cell" onclick={() => open('rename')}>
              <span class="ic" style:background="var(--tint)"><Icon name="pencil" size={17} /></span>
              <span class="grow">Omdøb</span>
              <span class="trail chev"><Icon name="chevron-right" size={16} /></span>
            </button>
            <button class="cell" onclick={() => open('note')}>
              <span class="ic" style:background="#8e8e93"><Icon name="note" size={17} /></span>
              <span class="grow">Note</span>
              <span class="trail ellip">{item.note}</span>
              <span class="trail chev"><Icon name="chevron-right" size={16} /></span>
            </button>
          </div>
        </div>

        <div class="group">
          <div class="card">
            <button
              class="cell destructive"
              onclick={() => {
                app.remove(uid);
                close();
              }}
            >
              <span class="grow center">Slet vare</span>
            </button>
          </div>
        </div>
      {:else if page === 'category'}
        <div class="group">
          <div class="card">
            {#each app.categories as cat (cat.id)}
              <button
                class="cell"
                onclick={() => {
                  app.update(uid, { category: cat.name });
                  page = 'main';
                }}
              >
                <span class="grow">{cat.name}</span>
                {#if currentCat?.id === cat.id}
                  <span class="tick"><Icon name="check" size={18} stroke={2.6} /></span>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {:else if page === 'rename'}
        <div class="group">
          <div class="card">
            <form
              class="cell"
              onsubmit={(e) => {
                e.preventDefault();
                saveRename();
              }}
            >
              <input
                class="field"
                bind:value={draft}
                use:focus
                enterkeyhint="done"
                autocomplete="off"
                aria-label="Navn"
              />
            </form>
          </div>
        </div>
      {:else}
        <div class="group">
          <div class="card">
            <div class="cell">
              <textarea class="field" rows="4" bind:value={draft} use:focus placeholder="F.eks. den økologiske" aria-label="Note"
              ></textarea>
            </div>
          </div>
          <p class="group-footer">Noten vises under varen og i andre apps, der læser listen.</p>
        </div>
      {/if}
    {/snippet}
  </Sheet>
{/if}

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
    text-align: center;
    max-width: 60vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .done {
    justify-self: end;
    font-weight: 600;
  }
  .back {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-left: -12px;
  }
  .stepper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 28px;
    padding: 8px 0 24px;
  }
  .step {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--card);
    color: var(--tint);
    display: grid;
    place-items: center;
    transition:
      transform 100ms var(--ease-out),
      background-color 100ms;
  }
  .step:active {
    transform: scale(0.92);
    background: var(--card-pressed);
  }
  .step:disabled {
    color: var(--label-3);
    transform: none;
  }
  .count {
    min-width: 72px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .num {
    font-size: 44px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }
  .unit {
    font-size: 13px;
    color: var(--label-2);
    margin-top: 4px;
  }
  .ic {
    flex: none;
    width: 29px;
    height: 29px;
    border-radius: 7px;
    color: #fff;
    display: grid;
    place-items: center;
  }
  .chev {
    color: var(--label-3);
    display: grid;
    margin-left: -6px;
  }
  .ellip {
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .center {
    text-align: center;
  }
  .tick {
    color: var(--tint);
    display: grid;
  }
  textarea {
    resize: none;
  }
</style>
