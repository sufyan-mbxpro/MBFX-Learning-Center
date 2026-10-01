// Every key that opens at least one screen under Settings (ADR-177).
//
// The sidebar's Settings row and the settings hub page each kept their own
// list, and both missed keys whose ONLY screen is a settings tab. The seeded
// Content Manager and Editor hold `translations.view` and nothing else under
// Settings, so the Translation review queue (their one translation screen) had
// no way in: no sidebar row, and the hub refused them. One list now, read by
// both, and `settings-entry-keys.test.ts` checks it against every tab gate.
//
// Each destination still re-checks its own key; holding one of these only
// opens the door to the hub, which then lists what the holder may see.
export const SETTINGS_ENTRY_KEYS = [
  "settings.view",
  // Settings → Translation → Site text is gated on this (with
  // `translations.update`), not on `settings.view`.
  "settings.update",
  "theme.update",
  "social.manage",
  "navigation.manage",
  // `support` holds only this one key under settings (ADR-078 #4).
  "email.log.view",
  "email.templates.view",
  // changes-37: the market provider card (ADR-121 §6).
  "market.providers.manage",
  // changes-51: AI lives here, with no sidebar entry of its own.
  "ai.usage.view",
  "ai.settings.manage",
  "ai.providers.manage",
  // ADR-163: Settings → Translation.
  "translations.view",
  // ADR-178: Settings → Translation → Interface text is gated on this alone.
  "translations.update",
  "locales.manage",
  "translations.provider.manage",
] as const;
