<script lang="ts">
  import { load, save } from '../lib/storage';
  import Icon from './Icon.svelte';

  // iOS Safari has no install prompt, so explain it once.
  const standalone =
    matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let show = $state(ios && !standalone && !load('installHintDismissed', false));

  function dismiss() {
    show = false;
    save('installHintDismissed', true);
  }
</script>

{#if show}
  <div class="group">
    <div class="card hint">
      <div class="text">
        <strong>Installer appen</strong>
        <span>Tryk på <Icon name="share" size={16} /> og vælg <em>Føj til hjemmeskærm</em>.</span>
      </div>
      <button class="close" onclick={dismiss} aria-label="Luk"><Icon name="xmark" size={14} stroke={2.6} /></button>
    </div>
  </div>
{/if}

<style>
  .hint {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 12px 12px 16px;
  }
  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 15px;
  }
  .text span {
    color: var(--label-2);
  }
  .text :global(svg) {
    vertical-align: -3px;
    color: var(--tint);
  }
  em {
    font-style: normal;
    font-weight: 600;
    color: var(--label);
  }
  .close {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--fill);
    color: var(--label-2);
    display: grid;
    place-items: center;
  }
</style>
