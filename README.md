# Priyx

Priyx is a modular TypeScript Discord bot. It uses its own internal Priyx core
module, reads global defaults from `modules.yml`, stores
server overrides in the database, and keeps secrets in `.env`.

## Setup

1. Install Node.js 22 LTS.
2. Run `npm install`.
3. Fill `.env` with `DISCORD_TOKEN` and `CLIENT_ID`.
4. Edit `modules.yml` for global defaults.
5. Run `npm run migrate` to create or update database tables.
6. Run `npm run deploy -- --guild SERVER_ID` for immediate slash commands, or
   `npm run deploy:global` for global slash commands.
7. Run `npm run dev` for development or `npm run build && npm start` for
   production.

## Commands

- `npm run typecheck`
- `npm run build`
- `npm run migrate`
- `npm run migrate -- --addon automod`
- `npm run deploy -- --guild SERVER_ID`
- `npm run deploy:global`
- `npm run deploy:list:global`
- `npm run cli -- make:command --name ping --addon core`

Guild deploys are visible immediately. Global deploys are accepted by Discord
immediately but can take time to appear in every server's slash command UI.
Use `npm run deploy:list:global` to verify what Discord currently has.

For Postgres, `DATABASE_SCHEMA` is optional. If it is empty, Priyx uses the
username from `DATABASE_URL` as the schema and creates it during migration.

## Addons

Each addon includes a manifest, register file, language file, helpers,
component handlers, tasks, models, migrations, and seeders. Addon feature config
starts from `modules.yml` and can be overridden per server through `/settings`
or `/addons`.

Server admins can run `/addons list`, `/addons enable <addon>`, and
`/addons disable <addon>`. Those commands require Manage Server.

## Tickets

Run `/ticket setup category-type:Button` or
`/ticket setup category-type:Select Menu` in Discord to open the interactive
panel builder. Use the buttons for title, description, color, image, thumbnail,
or panel buttons. The Buttons page lets you add/edit each ticket button or
dropdown option, then select the Discord category that specific option should
create tickets in. Press Save & Set Category after the buttons and fallback
category are configured.

After setup, run `/ticket panel` in any text channel or pass `panel_channel` to
post another panel using the saved settings. Staff use `/ticket claim`,
`/ticket transcript`, and `/ticket close` inside created ticket channels.

## Music

The music addon uses Rainlink with Lavalink. Configure Lavalink nodes under
`music.lavalink.nodes` in `modules.yml` and set `LAVALINK_PASSWORD` in `.env`.
`music.enabled` is only the global default; each server can enable it with
`/addons enable music`.

## Logs

Priyx writes bot logs to `logs/bot.log`, combined logs to `logs/combined.log`,
errors to `logs/error.log`, and addon-specific logs to `logs/addons/<addon>.log`.

Bot name: Priyx. Studio: Priyx. Developer: Priyx.
