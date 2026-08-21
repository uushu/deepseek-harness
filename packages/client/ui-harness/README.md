# @deepseek-ai/dsh-client-ui-harness

English | [中文](README.zh.md)

Optional Aqua visual skin for the Web client. The package overrides the active theme token stack, stamps package-owned DOM attributes for its glass surfaces, and mounts fluid, wallpaper, marine-life, mesh, spotlight, press, and particle-whale effects without changing the shared UI packages. Disabling the plugin's master switch disposes those effects and restores the stock interface.

The client contribution registers an Aqua card in the Plugins settings section and a Theme section containing the stock light, dark, and system choices plus Aqua controls. Browser-local preferences cover the enable flag, material mode, blur, frost, fluid palette, backdrop, decorations, and wallpaper tuning. Large video wallpapers use IndexedDB; supported Chromium browsers may also retain a File System Access handle after the user grants access.

The Host contribution is intentionally empty. The package requires the client runtime, locale, theme, settings, slots, and primitives services, and is included by a client composition through its dynamic plugin roster.

## Model Experience

None, as this package changes browser presentation and browser-local settings without adding prompt text, tools, session events, or provider requests.

#### KV Cache effect

None; the package never assembles model input.

## Known Limitations and Deferred Work

- Wallpaper persistence depends on browser storage quotas, and remembered file handles require File System Access API support plus user authorization.
- Visual seam stamping follows the current shared UI DOM structure; package tests must be updated when those component seams change.
- Aqua settings are browser-local and do not synchronize through the Host settings service.
