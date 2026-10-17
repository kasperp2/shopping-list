<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { app } from '../lib/store/app.svelte';
  import { reducedMotion } from '../lib/spring';
</script>

<div class="slot" aria-live="polite">
  {#if app.toast}
    {#key app.toast.id}
      <div class="toast" transition:fly={{ y: reducedMotion() ? 0 : 16, duration: 220, easing: cubicOut }}>
        <span>{app.toast.text}</span>
        {#if app.toast.action}
          {@const action = app.toast.action}
          <button
            onclick={() => {
              action.run();
              app.toast = null;
            }}>{action.label}</button
          >
        {/if}
      </div>
    {/key}
  {/if}
</div>

<style>
  .slot {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(var(--bottom-bar, 110px) + var(--keyboard, 0px) + 8px);
    z-index: 40;
    display: grid;
    justify-items: center;
    pointer-events: none;
  }
  .slot > * {
    grid-area: 1 / 1;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 16px;
    max-width: calc(100vw - 32px);
    padding: 10px 18px;
    border-radius: 22px;
    background: rgba(30, 30, 32, 0.92);
    color: #fff;
    font-size: 15px;
    font-weight: 500;
    box-shadow: var(--shadow);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  button {
    color: #64d2ff;
    font-weight: 600;
  }
</style>
