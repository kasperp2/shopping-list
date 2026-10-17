import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';
import './app.css';

registerSW({ immediate: true });

// iOS pans the page to keep a focused field visible and doesn't always pan
// back once the keyboard closes. Put it back when the viewport is full again.
const vv = window.visualViewport;
vv?.addEventListener('resize', () => {
  if (vv.height >= window.innerHeight - 1 && (window.scrollY || vv.offsetTop)) window.scrollTo(0, 0);
});

export default mount(App, { target: document.getElementById('app')! });
