# Kompas

AI-first boekhoudapp voor Nederlandse zzp'ers en kleine ondernemingen.

## Status

Dit is de eerste, werkende basisversie. **Wat echt werkt:**

- Registreren / inloggen (Supabase Auth)
- Dashboard met omzet/kosten/winst/openstaande facturen — berekend uit echte data
- Klantenbeheer (CRUD)
- Facturen met factuurregels, btw-berekening en status (CRUD)
- Inkomsten & uitgaven registreren (CRUD)
- Bonnetjes uploaden (Supabase Storage) en koppelen aan een uitgave
- BTW-overzicht per kwartaal, berekend uit je eigen transacties
- Centrale actielijst: handmatige taken + automatisch gegenereerde taken voor
  vervallen facturen en uitgaven zonder bonnetje

**Wat nog NIET werkt (bewust, nog niet gebouwd):**

- Geen bankkoppeling / automatisch afletteren van transacties
- Geen automatische btw-aangifte bij de Belastingdienst
- Geen AI-assistent

## Tech stack

- React + TypeScript + Vite
- Tailwind CSS v4 + eigen lichte UI-component-set (shadcn/ui-stijl)
- React Router
- Supabase (Postgres + Auth + Storage), met row-level security per gebruiker

## Lokaal opzetten

1. Maak een Supabase-project aan op [supabase.com](https://supabase.com).
2. Voer de migratie `supabase/migrations/0001_init.sql` uit in de Supabase SQL-editor
   (maakt alle tabellen, RLS-policies en de `receipts`-storage bucket aan).
3. Kopieer `.env.example` naar `.env.local` en vul je project-URL en anon key in
   (Supabase dashboard → Project Settings → API). Deze waarden horen **niet** in git.
4. Installeer dependencies en start de dev-server:

   ```bash
   npm install
   npm run dev
   ```

## Build & checks

```bash
npm run build   # productie-build
npm run lint    # ESLint
```

## Beveiliging

- Alle tabellen hebben row-level security: een gebruiker ziet en bewerkt alleen
  zijn eigen data.
- Er staan geen API-sleutels of secrets in de repository — alleen de public
  Supabase anon key via environment variables, die hoort client-side te staan.
- Bonnetjes worden privé opgeslagen; toegang verloopt via tijdelijke signed URLs.
