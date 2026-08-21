# Agent Note: Aqua visual skin plugin

Status: implemented

English | [中文](2026-08-17-harness-site-theme.zh.md)

## Problem

The Web client needed an optional visual treatment inspired by the DeepSeek Harness site without expanding the shared theme preference schema or coupling glass effects to core layout, conversation, sidebar, primitive, and settings packages. The treatment also needed a single switch that restored the stock interface and deterministic behavior suitable for visual testing.

## Decision

`@deepseek-ai/dsh-client-ui-harness` owns the Aqua skin as a dynamic client plugin. It layers light and dark token overrides through `ctx.theme.overrideTokens`, scopes presentation CSS and package-owned seam attributes to the enabled layer, and mounts its fluid background, wallpaper, marine-life, mesh, spotlight, press, and particle-whale effects through Cordis effects. The shared UI packages keep their stock theme and component behavior.

The plugin registers a master card in the Plugins settings section and a Theme section containing the stock appearance choices plus Aqua controls. Browser-local storage owns the enable flag and tuning values. Large video blobs use IndexedDB, and supported Chromium browsers may retain a user-authorized File System Access handle. The Host half remains an intentional no-op because the feature changes browser presentation only.

The visual parameters and screenshot acceptance criteria live in [`docs/ui/harness-site-visual-spec.md`](../../../../docs/ui/harness-site-visual-spec.md). The package's styles avoid applying `backdrop-filter` to containers that establish positioning contexts for fixed overlays; blur belongs to isolated pseudo-elements instead.

## Consequences

Disabling or unloading the plugin disposes its token layer, attributes, ambient elements, observers, and settings registrations, returning the stock interface without a second shared theme implementation. The skin can evolve independently, but its seam-stamping tests must track intentional shared DOM changes. Preferences remain browser-local and do not synchronize through Host settings.

Verification covers the package's client application and layer behavior, the affected settings and theme surfaces, the client TypeScript graph, and the assembled Web build. A running Web composition must restart after its plugin roster changes because the manifest is fixed during startup.

## Alternatives considered

- Adding `harness` as a fourth built-in theme was rejected because it expanded the shared persisted preference schema and made presentation effects core-package responsibilities.
- Keeping ambient and glass behavior directly in shared UI packages was rejected because dark and light themes could accidentally inherit skin-specific behavior.
- Maintaining a parallel fork of the Web shell was rejected because it would duplicate composition and component ownership.
