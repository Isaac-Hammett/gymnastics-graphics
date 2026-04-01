# Fixes Needed

- task:4 | Theme preview does not apply colors — `&theme=pink-meet-2026` URL param leaves header bar gray (#d4d4d8) instead of pink (#ea018c) | `applyTheme()` in stage.html reads `theme.headerBg` but Firebase stores colors at `theme.colors.headerBar` — the function needs to extract from `theme.colors` object
