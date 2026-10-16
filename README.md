# Kompas

AI-first boekhoudapp voor Nederlandse zzp'ers en kleine ondernemingen.

## Status

**Fase 3 (facturen professioneel maken) is doorgevoerd, bovenop fase 2.** Wat echt werkt:

- Factuur-PDF genereren in Kompas-huisstijl (bedrijfsgegevens, klantgegevens,
  regels, btw-specificatie per tarief, betaalgegevens) — direct downloadbaar
  vanuit de facturenlijst
- Bedrijfs- en betaalgegevens instellen (Instellingen-pagina): naam, KvK,
  btw-nummer, adres, e-mail, telefoon, IBAN, factuurvoettekst
- Factuur per e-mail versturen naar de klant mét PDF-bijlage (Supabase Edge
  Function + Resend) — vereist **handmatige deploy en secret-configuratie**,
  zie "Facturen per e-mail versturen" hieronder
- Verzendstatus zichtbaar per factuur: wanneer en naar welk adres verstuurd,
  of een foutmelding als het versturen mislukte

**Fase 2 (betrouwbaarheid & beveiliging), al eerder doorgevoerd:**

- Registreren / inloggen (Supabase Auth)
- Dashboard met omzet/kosten/winst/openstaande facturen — berekend uit echte
  data, in hele centen (geen drijvendekommafouten)
- Klantenbeheer (CRUD)
- Facturen met factuurregels, atomische factuurnummering, btw-berekening en
  status (CRUD). Betaalde facturen liggen vast: nummer, klant, datum en
  regels kunnen niet meer gewijzigd of verwijderd worden (database-trigger +
  UI-slot)
- Inkomsten & uitgaven registreren (CRUD), met validatie
- Bonnetjes uploaden (Supabase Storage, max 10 MB, alleen afbeeldingen/pdf)
  en koppelen aan een uitgave
- BTW-overzicht per kwartaal, berekend uit je eigen transacties (centen-basis)
- Centrale actielijst: handmatige taken + automatisch gegenereerde taken voor
  vervallen facturen en uitgaven zonder bonnetje

**Wat nog NIET werkt (bewust, nog niet gebouwd):**

- Geen bankkoppeling / automatisch afletteren van transacties
- Geen automatische btw-aangifte bij de Belastingdienst
- Geen AI-assistent
- Geen terugkerende taken of automatische betalingsherinneringen (fase 3-vervolg)

## Tech stack

- React + TypeScript + Vite
- Tailwind CSS v4 + eigen lichte UI-component-set (shadcn/ui-stijl)
- React Router
- Supabase (Postgres + Auth + Storage), met row-level security per gebruiker
- Vitest voor unit-tests van geld-/btw-logica

## Lokaal opzetten

1. Maak een Supabase-project aan op [supabase.com](https://supabase.com).
2. Voer de migraties **in volgorde** uit in de Supabase SQL-editor:
   - `supabase/migrations/0001_init.sql` — tabellen, RLS-policies, `receipts`-bucket
   - `supabase/migrations/0002_hardening.sql` — cross-tabel eigendomscontrole,
     data-constraints, atomische factuurnummering, bescherming van betaalde
     facturen, storage-limieten, extra indexen
   - `supabase/migrations/0003_invoicing_settings.sql` — betaalgegevens op het
     profiel, verzendstatus op facturen, RPC's voor het markeren van
     verzonden facturen en verzendfouten (gebruikt door de send-invoice
     edge function, zie "Facturen per e-mail versturen" hieronder)
3. Kopieer `.env.example` naar `.env.local` en vul je project-URL en anon key in
   (Supabase dashboard → Project Settings → API). Deze waarden horen **niet** in git.
4. Installeer dependencies en start de dev-server:

   ```bash
   npm install
   npm run dev
   ```

### Handmatige Supabase-instellingen (niet via migratie te zetten)

- **Auth → URL Configuration**: zet de Site URL en Redirect URLs op je
  productie-domein zodra je live gaat (anders werken bevestigingsmails niet).
- **Auth → Providers → Email**: overweeg "Confirm email" aan te laten staan
  (standaard aan) zodat gebruikers hun e-mailadres moeten bevestigen.
- **Auth → Rate limits / Leaked password protection**: aanbevolen om "leaked
  password protection" aan te zetten (Supabase Dashboard → Authentication →
  Policies), dit kan niet via SQL-migratie.
- **Storage → receipts bucket**: migratie 0002 zet `file_size_limit` en
  `allowed_mime_types` via SQL. Mocht dat op jouw project niet lukken (oudere
  Supabase-versie), stel dit dan handmatig in via Dashboard → Storage →
  receipts → Edit bucket (max 10 MB, image/png, image/jpeg, image/webp,
  image/heic, application/pdf).

## Facturen per e-mail versturen (handmatige configuratie, fase 3)

De PDF-generatie en download werken zonder extra configuratie. Het **versturen
per e-mail** vereist een eenmalige handmatige deploy, omdat dit niet via een
SQL-migratie kan:

1. **Resend-account**: maak een gratis account op [resend.com](https://resend.com)
   en kopieer een API-key. Voor productiegebruik: verifieer je eigen domein bij
   Resend (anders kun je alleen naar je eigen, geverifieerde testadres sturen).
2. **Supabase CLI installeren en inloggen** (lokaal, niet in deze repo):
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <jouw-project-ref>
   ```
3. **De edge function deployen**:
   ```bash
   supabase functions deploy send-invoice
   ```
4. **Secrets instellen** (nooit in `.env` of git — dit zijn server-side
   secrets voor de edge function):
   ```bash
   supabase secrets set RESEND_API_KEY=re_jouw_sleutel
   # Optioneel, standaard is het Resend-testadres:
   supabase secrets set SEND_INVOICE_FROM_EMAIL="Kompas <facturen@jouwdomein.nl>"
   ```
5. Vul in Kompas onder **Instellingen** je IBAN en bedrijfsgegevens in — deze
   verschijnen op de factuur-PDF.

**Hoe het werkt** (voor controleerbaarheid): de PDF wordt in de browser
gegenereerd (dezelfde code als de downloadknop) en als bijlage meegestuurd
naar de edge function. De edge function gebruikt de JWT van de ingelogde
gebruiker (niet een service-role key) om de factuur en het klant-e-mailadres
op te halen, zodat Row Level Security ook hier van toepassing blijft — een
gebruiker kan nooit andermans factuur versturen, ook niet door een ander
`invoice_id` mee te sturen in het verzoek. Na een geslaagde verzending wordt
de factuurstatus bijgewerkt via `mark_invoice_sent`; bij een fout (bv.
verkeerde API-key, geen krediet bij Resend) wordt deze vastgelegd via
`record_invoice_send_error` en zichtbaar gemaakt in de facturenlijst, in
plaats van stil te falen.

Zonder deze configuratie werkt de rest van de app gewoon door; de
verstuur-knop toont dan een duidelijke Nederlandse foutmelding met een
verwijzing naar deze sectie.

## Build & checks

```bash
npm run build   # typecheck + productie-build
npm run lint    # ESLint/oxlint
npm run test    # Vitest — geld-, btw- en datumlogica
```

Alle drie zijn getest en slagen op de huidige code. De database-migraties zijn
daadwerkelijk uitgevoerd en functioneel getest tegen een lokale Postgres
(niet alleen syntax-gecontroleerd) — zie "Hoe fase 2 is getest" hieronder.

## Beveiliging

- Alle tabellen hebben row-level security: een gebruiker ziet en bewerkt alleen
  zijn eigen data — geverifieerd met daadwerkelijke queries als twee losse
  testgebruikers (zie hieronder), niet alleen gelezen uit de policy-definities.
- **Cross-tabel eigendomscontrole** (migratie 0002): RLS alleen voorkomt dat je
  rijen van een ander leest/wijzigt, maar niet dat je een rij met je eigen
  `user_id` aanmaakt die verwijst naar bv. een factuur, transactie of klant
  van iemand anders. Dit wordt nu met database-triggers afgedwongen op
  `invoice_lines`, `transactions`, `receipts`, `tasks` en `invoices.customer_id`.
- Er staan geen API-sleutels of secrets in de repository — alleen de public
  Supabase anon key via environment variables, die hoort client-side te staan.
- Bonnetjes worden privé opgeslagen onder `user_id/...`; RLS op
  `storage.objects` zorgt dat gebruikers alleen bij hun eigen map kunnen.
  Bestandstype en -grootte worden zowel client-side als op bucket-niveau
  beperkt.
- Betaalde facturen zijn vergrendeld tegen wijzigen/verwijderen via een
  database-trigger (niet alleen in de UI, dus ook afgedwongen bij directe
  API-aanroepen).

## Financiële correctheid

- Alle geld- en btw-berekeningen in de frontend gebeuren in hele centen
  (`src/lib/money.ts`), niet in drijvendekommagetallen, om afrondfouten te
  voorkomen. Btw wordt per factuurregel afgerond (gangbare NL-praktijk).
- Factuurnummers worden atomisch toegekend door de database
  (`next_invoice_number` functie met een rij-lock per gebruiker/jaar), zodat
  twee gelijktijdige nieuwe facturen nooit hetzelfde nummer krijgen.
- Factuur + factuurregels worden in één database-transactie weggeschreven
  (`save_invoice` functie), zodat er bij een fout halverwege geen regels
  kwijtraken.
- Datums worden in de lokale tijdzone van de gebruiker berekend (niet via
  UTC-conversie), wat belangrijk is rond middernacht voor gebruikers in
  Nederland (UTC+1/+2) — zie "Gevonden en opgeloste problemen" hieronder.

## Hoe fase 2 is getest

Niet alleen "de build slaagt" — concreet uitgevoerd:

1. **Migraties echt toegepast** tegen een lokale Postgres 16 (niet alleen
   syntax-gecheckt): beide migraties draaien foutloos op een vers schema.
2. **RLS en triggers functioneel getest** met twee losse databasegebruikers
   (niet als superuser, die RLS altijd omzeilt) die elkaars klanten,
   facturen, factuurregels, transacties, bonnetjes en taken probeerden te
   lezen/wijzigen/verwijderen — elke ongeoorloofde actie werd daadwerkelijk
   geweigerd door de database.
3. **Atomische factuurnummering** getest: opeenvolgende nummers per jaar,
   aparte teller per jaar.
4. **Bescherming van betaalde facturen** getest: nummer/klant/datum wijzigen
   geweigerd, regels wijzigen geweigerd, verwijderen geweigerd, status
   terugzetten (correctie) wél toegestaan.
5. **Data-constraints** getest: negatieve aantallen en ongeldige btw-tarieven
   worden geweigerd door de database, los van wat de UI toestaat.
6. **Unit-tests** (`npm run test`) voor geld-/btw-rekenwerk (inclusief de
   klassieke 0.1+0.2-float-valkuil) en kwartaalgrenzen, ook getest in
   meerdere tijdzones.

## Hoe fase 3 is getest

1. **PDF-generatie daadwerkelijk uitgevoerd en visueel gecontroleerd**: een
   realistische voorbeeldfactuur (3 regels, btw-tarieven 21%/9%/0%, een
   niet-geheel aantal om afronding te toetsen) is gegenereerd met de echte
   `InvoicePdf`-code, als PDF weggeschreven en pagina voor pagina bekeken —
   layout, Nederlandse labels, btw-specificatie per tarief, totalen en het
   betaalblok (dat alleen verschijnt als IBAN is ingevuld) kloppen.
2. **De nieuwe database-functies (`mark_invoice_sent`,
   `record_invoice_send_error`) echt uitgevoerd** tegen een lokale Postgres,
   niet alleen gelezen: een factuur aangemaakt, een verzendfout vastgelegd
   (status bleef `concept`, `send_error` gevuld), daarna succesvol gemarkeerd
   als verzonden (`send_error` weer leeg, status naar `verzonden`,
   `sent_at`/`sent_to_email` gevuld).
3. **Cross-gebruiker-toegang opnieuw getest** met twee losse databasegebruikers:
   een tweede gebruiker die `record_invoice_send_error` op de factuur van de
   eerste probeerde aan te roepen, werd geweigerd ("Factuur niet gevonden of
   geen toegang") — de nieuwe RPC's zijn dus niet een nieuw lek in de
   eigendomscontrole uit fase 2.
4. `npx tsc -b`, `npm run lint`, `npm run test` (14/14) en `npm run build`
   zijn allemaal uitgevoerd op de volledige fase 3-code en slagen.
5. De edge function zelf (`supabase/functions/send-invoice`) kon **niet**
   end-to-end tegen een echte Resend-mailbox getest worden vanuit deze
   omgeving (geen live Supabase-project of Resend-account beschikbaar hier).
   De database-kant (RPC's) is wel echt getest zoals hierboven beschreven; de
   HTTP-aanroep naar Resend zelf moet je na deploy met een eigen testfactuur
   verifiëren.

## Gevonden en opgeloste problemen (fase 2-audit)

- **Tijdzone-bug**: datums werden via `Date#toISOString()` berekend, wat voor
  gebruikers in Nederland (UTC+1/+2) rond middernacht een dag kon
  terugschuiven (bv. "vandaag" werd "gisteren" in de database). Dit raakte de
  BTW-kwartaalgrenzen, de standaarddatum bij nieuwe facturen/transacties, en
  de "vervallen factuur"-detectie in de taken-module. Opgelost met
  tijdzone-veilige datumfuncties, en met een test die dit expliciet
  controleert.
- **Factuurnummering**: het nummer werd client-side geraden
  (`F-{jaar}-{aantal facturen + 1}`), wat bij twee gelijktijdige nieuwe
  facturen (of na het verwijderen van een factuur) tot dubbele nummers kon
  leiden. Vervangen door een atomische database-functie.
- **Dataverlies bij een fout**: factuur en regels werden in twee losse
  API-calls opgeslagen (eerst oude regels verwijderen, dan nieuwe invoegen).
  Als de tweede call faalde, waren de oude regels al kwijt. Vervangen door
  één atomische database-functie (`save_invoice`).
- **Ontbrekende cross-tabel controle**: RLS beschermde losse tabellen, maar
  niet tegen het koppelen van eigen rijen aan andermans facturen/transacties
  (bv. een factuurregel toevoegen aan iemand anders' factuur). Opgelost met
  eigendomscontrole-triggers.
- **Drijvendekommafouten** in geld-/btw-berekeningen: vervangen door
  centen-gebaseerde rekenlogica.
- **Geen bescherming van betaalde facturen**: een betaalde factuur kon
  stilzwijgend gewijzigd of verwijderd worden. Nu vergrendeld op
  database-niveau.
- **Geen bestandsvalidatie bij bonnetjes**: elk bestandstype en elke grootte
  werd geaccepteerd. Nu beperkt tot 10 MB, afbeeldingen/pdf, zowel
  client-side als op de storage-bucket.
