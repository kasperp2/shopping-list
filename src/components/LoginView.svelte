<script lang="ts">
  import { DavError, isNetworkError } from '../lib/dav/client';
  import { app } from '../lib/store/app.svelte';

  let server = $state('');
  let username = $state('');
  let password = $state('');
  let busy = $state(false);
  let error = $state('');

  const canSubmit = $derived((app.config.proxy || server.trim()) && username.trim() && password && !busy);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    busy = true;
    error = '';
    try {
      await app.login(server, username, password);
    } catch (err) {
      if (err instanceof DavError) error = err.message;
      else if (isNetworkError(err))
        error = app.config.proxy
          ? 'Kan ikke nå serveren. Er du online?'
          : 'Kan ikke nå serveren. Tjek adressen – og at serveren tillader CORS fra denne side.';
      else error = 'Noget gik galt. Prøv igen.';
    } finally {
      busy = false;
    }
  }
</script>

<main class="login">
  <div class="hero">
    <img src="/icon-192.png" alt="" width="84" height="84" />
    <h1>Indkøb</h1>
    <p>Log ind på din CalDAV-server for at se dine indkøbslister.</p>
  </div>

  <form onsubmit={submit}>
    <div class="group">
      <div class="card">
        {#if !app.config.proxy}
          <label class="cell">
            <span class="lbl">Server</span>
            <input
              class="field"
              bind:value={server}
              placeholder="dav.eksempel.dk"
              autocomplete="url"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              inputmode="url"
              enterkeyhint="next"
            />
          </label>
        {/if}
        <label class="cell">
          <span class="lbl">Bruger</span>
          <input
            class="field"
            bind:value={username}
            placeholder="Brugernavn"
            autocomplete="username"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="next"
          />
        </label>
        <label class="cell">
          <span class="lbl">Kode</span>
          <input
            class="field"
            type="password"
            bind:value={password}
            placeholder="Adgangskode"
            autocomplete="current-password"
            enterkeyhint="go"
          />
        </label>
      </div>
      {#if error}
        <p class="group-footer err" role="alert">{error}</p>
      {:else}
        <p class="group-footer">Login gemmes kun i denne browser. Brug gerne en app-adgangskode.</p>
      {/if}
    </div>

    <div class="group">
      <button class="primary" type="submit" disabled={!canSubmit}>
        {busy ? 'Logger ind…' : 'Log ind'}
      </button>
    </div>
  </form>
</main>

<style>
  .login {
    min-height: 100dvh;
    padding: calc(var(--safe-top) + 48px) 0 calc(var(--safe-bottom) + 24px);
    max-width: 520px;
    margin: 0 auto;
  }
  .hero {
    text-align: center;
    padding: 0 32px 28px;
  }
  .hero img {
    border-radius: 19px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }
  h1 {
    margin: 16px 0 6px;
    font-size: 34px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }
  .hero p {
    margin: 0;
    color: var(--label-2);
    font-size: 15px;
    line-height: 20px;
  }
  .lbl {
    width: 64px;
    flex: none;
  }
  .err {
    color: var(--red);
  }
  .primary {
    width: 100%;
    height: 50px;
    border-radius: 12px;
    background: var(--tint);
    color: #fff;
    font-weight: 600;
    transition:
      transform 100ms var(--ease-out),
      opacity 100ms;
  }
  .primary:active {
    transform: scale(0.98);
  }
  .primary:disabled {
    opacity: 0.4;
    transform: none;
  }
</style>
