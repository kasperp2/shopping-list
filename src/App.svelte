<script lang="ts">
  import { onMount } from 'svelte';
  import HistoryView from './components/HistoryView.svelte';
  import ListView from './components/ListView.svelte';
  import LoginView from './components/LoginView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import Toast from './components/Toast.svelte';
  import { app } from './lib/store/app.svelte';

  let page = $state<'list' | 'history' | 'settings'>('list');

  onMount(() => {
    void app.init();
  });

  $effect(() => {
    if (!app.creds) page = 'list';
  });
</script>

{#if app.ready}
  {#if !app.creds}
    <LoginView />
  {:else}
    <div inert={page !== 'list'}>
      <ListView onhistory={() => (page = 'history')} onsettings={() => (page = 'settings')} />
    </div>
    {#if page === 'history'}
      <HistoryView onback={() => (page = 'list')} />
    {:else if page === 'settings'}
      <SettingsView onback={() => (page = 'list')} />
    {/if}
  {/if}
  <Toast />
{/if}
