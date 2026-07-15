---
description: "Language conventions: English for code, conversation language for UI text"
paths:
  - {{backend}}/src/**/*.ts
  - {{frontend}}/**/*.ts
  - {{frontend}}/**/*.tsx
---

# Language Conventions

## Code — always English

All code identifiers must be in English, no exceptions: variable names, function names, component names, object keys, type/interface fields, enum values, file names, URL paths/segments, route params, and query param names.

Examples:

- Routes: `/dashboard/settings` not `/dashboard/configuracion`
- Component names: `UserSettingsPage` not `ConfiguracionUsuarioPage`
- Object keys: `{ firstName: '...' }` not `{ nombre: '...' }`
- Enums: `Role.ADMIN` not `Role.ADMINISTRADOR`

## UI-facing text — language of the conversation

Labels, buttons, headings, placeholders, error messages, and toasts must be written in the language the user is speaking — **Spanish by default** unless the user writes in another language.

Examples:

- Spanish conversation: `"Guardar cambios"` not `"Save changes"`
- English conversation: `"Save changes"` not `"Guardar cambios"`

## Comments and docs

Follow the same rule as UI text: match the language of the conversation unless the user explicitly writes in another language.
