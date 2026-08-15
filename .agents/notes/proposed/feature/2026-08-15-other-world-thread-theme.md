# Agent Note: Other World Thread built-in theme

Status: proposed

## Problem

The web client persists only light, dark, and system appearance preferences, while registered extension themes are process-local. A product theme therefore cannot currently survive a loopback restart or receive the pre-plugin bootstrap that prevents a palette flash. The requested DSH visual direction also needs a controlled way to introduce a deep-blue canvas, cyan system focus, warm-orange actions, fabric-like neutrals, and button/thread motifs without scattering literal colors or theme selectors through feature packages.

## Proposal

Add `other-world` as a persisted built-in preference and a dark-base `ThemeDefinition`. Keep its literal palette values in `ui-theme/src/styles/other-world.css`, map those values onto the existing `--dsw-alias-*` and `--dsw-specific-*` roles in `other-world-theme.ts`, and let the existing ThemePresenter apply the resulting snapshot. The Host bootstrap applies the same alias map before the shell mounts so the first rendered frame matches the durable preference. The Appearance row adds a fourth choice with an original four-hole button glyph. Feature packages remain theme-oblivious and continue consuming semantic tokens.

The visual source is a stop-motion gothic-fairytale grammar rather than copied film artwork: deep cool ambient space, limited warm action light, tactile thread/button cues, framed depth, and restrained handmade irregularity. No character likeness, film logo, still-image wallpaper, or other literal movie asset becomes part of the product theme.

## Alternatives considered

**Keep Other World as a third-party registered theme.** This preserves the existing registry boundary but loses durable selection and the Host bootstrap, so the user sees a process-local theme that can flash back to the base palette on load.

**Branch component CSS by theme.** Adding theme selectors or color literals to conversation, sidebar, composer, and primitives would reproduce the same palette in many owners and violate the web styling contract.

**Use film stills or character art as the background.** Literal imagery would reduce text contrast, couple product UI to copyrighted visual assets, and turn the theme into a skin instead of a reusable design language.

## Acceptance criteria

- `other-world` is accepted by the Host settings schema, appears in Appearance, persists through the existing preference path, and resolves to a dark-base theme.
- The pre-plugin bootstrap applies and clears the same semantic alias overrides that ThemePresenter later owns, preventing an initial base-theme frame.
- Palette literals live only in the theme-owned style sheet; feature components continue to consume semantic aliases and contain no new theme selectors.
- Theme runtime, Host bootstrap, and Appearance tests cover the new preference, and the web visual snapshot is refreshed before merge.
- English and Chinese theme documentation describe the same current contract and translation-pair records are refreshed.

## Risks

The alias map is broad enough to retint the existing shell but does not by itself create every tactile motif from the design study; stitched borders, tunnel transitions, and other narrative treatments require separate component-level work that still uses semantic tokens. The bootstrap serializes the alias map into the index response, increasing the inline script size. Accessibility and code readability remain higher priority than reproducing reference-film contrast exactly.
