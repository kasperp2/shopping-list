<script lang="ts" module>
  // SF Symbols–like line icons, 24×24 grid.
  const PATHS = {
    'chevron-down': 'M6 9.5l6 6 6-6',
    'chevron-left': 'M15 5l-7 7 7 7',
    'chevron-right': 'M9 5l7 7-7 7',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4.5V12l3.5 2',
    gear: 'M10.48 4.96L10.72 2.49h2.56l.24 2.47A7.2 7.2 0 0 1 15.91 5.95l1.91-1.58 1.81 1.81-1.58 1.91A7.2 7.2 0 0 1 19.04 10.48l2.47.24v2.56l-2.47.24A7.2 7.2 0 0 1 18.05 15.91l1.58 1.91-1.81 1.81-1.91-1.58A7.2 7.2 0 0 1 13.52 19.04l-.24 2.47h-2.56l-.24-2.47A7.2 7.2 0 0 1 8.09 18.05l-1.91 1.58-1.81-1.81 1.58-1.91A7.2 7.2 0 0 1 4.96 13.52l-2.47-.24v-2.56l2.47-.24A7.2 7.2 0 0 1 5.95 8.09L4.37 6.18l1.81-1.81 1.91 1.58A7.2 7.2 0 0 1 10.48 4.96zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    ellipsis: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    trash: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5',
    bolt: 'M13 2.5L5 13.5h6l-1 8 8-11h-6z',
    tag: 'M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0zM8 8h.01',
    pencil: 'M21.17 6.81a1 1 0 0 0-3.98-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5zM15 5l4 4',
    note: 'M5 4h14v16H5zM8.5 8.5h7M8.5 12h7M8.5 15.5h4',
    cloudoff: 'M3 3l18 18M8 7.6A5.5 5.5 0 0 1 17.4 10h.1a3.8 3.8 0 0 1 2.7 6.4M16 18H7a4 4 0 0 1-1.6-7.7',
    xmark: 'M6 6l12 12M18 6L6 18',
    grip: 'M5 8h14M5 12h14M5 16h14',
    search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5L20 20',
    share: 'M12 15V3.5M8 7l4-4 4 4M6 11H5v9.5h14V11h-1',
    arrows: 'M8 4v16M4.5 7.5L8 4l3.5 3.5M16 20V4M12.5 16.5L16 20l3.5-3.5',
    list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 22, stroke = 2 }: { name: IconName; size?: number; stroke?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={name === 'ellipsis' ? 3.2 : stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={PATHS[name]} />
</svg>
