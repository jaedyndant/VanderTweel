# Van der Tweel — Cemagi Atelier

Platform voor Van der Tweel / Cemagi Atelier: publieke website, koper-app en back-office,
gebouwd als één Next.js-project op Vercel met een gedeelde Neon Postgres-database.

Zie `/docs` (Technisch Ontwerp en Plan van Aanpak) voor architectuur, datamodel en planning.

## Setup

```bash
npm install
cp .env.example .env.local   # vul lokale waarden in, of `vercel env pull`
npm run db:migrate           # genummerde migraties toepassen (drizzle/)
npm run dev
```

## Structuur

- `src/app/(site)` — publieke website (geen login)
- `src/app/(koper)` — koper-app, achter magic-link login
- `src/app/(office)` — back-office (developer + projectmanager)
- `src/db/schema.ts` — datamodel (TO hoofdstuk 7)
- `drizzle/` — genummerde migraties (nooit het schema direct aanpassen, PvA 4.6)

## Git-workflow (PvA 4.6)

Eén taak = één branch = één pull request. Branches genoemd naar milestone/taak
(bv. `ms2-login-accounts`). Main is protected, geen force-push.
