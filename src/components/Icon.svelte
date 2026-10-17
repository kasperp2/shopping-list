<script lang="ts" module>
  // SF Symbols–like line icons, 24×24 grid.
  const PATHS = {
    'chevron-down': 'M6 9.5l6 6 6-6',
    'chevron-left': 'M15 5l-7 7 7 7',
    'chevron-right': 'M9 5l7 7-7 7',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4.5V12l3.5 2',
    gear: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 13.5l1.6 1.2-1.8 3.1-1.9-.7a7.4 7.4 0 0 1-2 1.2l-.3 2H11l-.3-2a7.4 7.4 0 0 1-2-1.2l-1.9.7L5 14.7l1.6-1.2a7.5 7.5 0 0 1 0-3L5 9.3l1.8-3.1 1.9.7a7.4 7.4 0 0 1 2-1.2l.3-2h3.6l.3 2a7.4 7.4 0 0 1 2 1.2l1.9-.7L20.6 9.3 19 10.5a7.5 7.5 0 0 1 .4 3z',
    ellipsis: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    trash: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5',
    bolt: 'M13 2.5L5 13.5h6l-1 8 8-11h-6z',
    tag: 'M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0zM8 8h.01',
    pencil: 'M4 20l1-4.5L16 4.5a2.1 2.1 0 0 1 3 3L8 18.5zM14 7l3 3',
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
