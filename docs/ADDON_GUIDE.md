# Priyx Addon Guide

Priyx addons live under `addons/<addon-name>` and are loaded when the matching
global entry in `modules.yml` has `enabled: true`.

Commands export `new PriyxCommand(...)`, events export `new PriyxEvent(...)`,
and scheduled tasks export a `PriyxTask`. Feature settings must be read through
`await client.guildModule(guildId, '<addon-name>')` for guild features so server
overrides are respected. Use `client.module('<addon-name>')` only for global
defaults or non-guild code. Secrets are the only values that belong in `.env`.

## Folder Layout

Every addon follows the same structure:

```text
addons/<addon-name>/
  addon.json
  register.ts
  commands/
  events/
  buttons/
  modals/
  select_menus/
  tasks/
  helpers/
  lang/en-US.json
  database/models/
  database/migrations/
  database/seeders/
```

`register.ts` exports a `PriyxAddon` instance. Commands, events, tasks, buttons,
select menus, and modals are loaded automatically. Database models expose
`initModel(sequelize)`, and migrations export `new PriyxMigration(...)`.

Use `npx tsx src/cli.ts make:command --name ping --addon core` to scaffold a
command with the local TypeScript patterns.
