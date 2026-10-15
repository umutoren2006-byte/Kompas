-- Kompas: fase 2 — betrouwbaarheid en beveiliging
-- Bouwt voort op 0001_init.sql. Voer uit NA 0001 op een bestaand project,
-- of als onderdeel van een verse installatie (migraties lopen op volgorde).

-- ============================================================
-- 1. CROSS-TABEL EIGENDOMSCONTROLE
-- RLS op user_id voorkomt dat gebruiker A rijen van gebruiker B leest/wijzigt,
-- maar voorkomt NIET dat gebruiker A een rij met zijn eigen user_id aanmaakt
-- die verwijst naar een invoice_id/transaction_id van gebruiker B (bv. een
-- factuurregel toevoegen aan andermans factuur, of een bonnetje koppelen aan
-- andermans uitgave). Dat wordt hier met triggers afgedwongen.
-- ============================================================

create or replace function public.check_invoice_line_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  invoice_owner uuid;
begin
  select user_id into invoice_owner from public.invoices where id = new.invoice_id;
  if invoice_owner is null then
    raise exception 'Factuur bestaat niet';
  end if;
  if invoice_owner <> new.user_id then
    raise exception 'Factuurregel user_id komt niet overeen met eigenaar van de factuur';
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_lines_owner_check on public.invoice_lines;
create trigger invoice_lines_owner_check
  before insert or update on public.invoice_lines
  for each row execute procedure public.check_invoice_line_owner();

create or replace function public.check_transaction_invoice_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  invoice_owner uuid;
begin
  if new.invoice_id is null then
    return new;
  end if;
  select user_id into invoice_owner from public.invoices where id = new.invoice_id;
  if invoice_owner is null then
    raise exception 'Gekoppelde factuur bestaat niet';
  end if;
  if invoice_owner <> new.user_id then
    raise exception 'Transactie kan niet gekoppeld worden aan een factuur van een andere gebruiker';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_invoice_owner_check on public.transactions;
create trigger transactions_invoice_owner_check
  before insert or update on public.transactions
  for each row execute procedure public.check_transaction_invoice_owner();

create or replace function public.check_receipt_transaction_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  tx_owner uuid;
begin
  if new.transaction_id is null then
    return new;
  end if;
  select user_id into tx_owner from public.transactions where id = new.transaction_id;
  if tx_owner is null then
    raise exception 'Gekoppelde transactie bestaat niet';
  end if;
  if tx_owner <> new.user_id then
    raise exception 'Bonnetje kan niet gekoppeld worden aan een transactie van een andere gebruiker';
  end if;
  return new;
end;
$$;

drop trigger if exists receipts_transaction_owner_check on public.receipts;
create trigger receipts_transaction_owner_check
  before insert or update on public.receipts
  for each row execute procedure public.check_receipt_transaction_owner();

create or replace function public.check_task_refs_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  owner uuid;
begin
  if new.related_invoice_id is not null then
    select user_id into owner from public.invoices where id = new.related_invoice_id;
    if owner is null or owner <> new.user_id then
      raise exception 'Taak kan niet verwijzen naar een factuur van een andere gebruiker';
    end if;
  end if;
  if new.related_transaction_id is not null then
    select user_id into owner from public.transactions where id = new.related_transaction_id;
    if owner is null or owner <> new.user_id then
      raise exception 'Taak kan niet verwijzen naar een transactie van een andere gebruiker';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_refs_owner_check on public.tasks;
create trigger tasks_refs_owner_check
  before insert or update on public.tasks
  for each row execute procedure public.check_task_refs_owner();

-- Klant van een factuur moet ook van dezelfde gebruiker zijn
create or replace function public.check_invoice_customer_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  owner uuid;
begin
  if new.customer_id is null then
    return new;
  end if;
  select user_id into owner from public.customers where id = new.customer_id;
  if owner is null or owner <> new.user_id then
    raise exception 'Factuur kan niet gekoppeld worden aan een klant van een andere gebruiker';
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_customer_owner_check on public.invoices;
create trigger invoices_customer_owner_check
  before insert or update on public.invoices
  for each row execute procedure public.check_invoice_customer_owner();

-- ============================================================
-- 2. DATA-CONSTRAINTS (financiële correctheid)
-- ============================================================

alter table public.invoice_lines
  drop constraint if exists invoice_lines_quantity_check,
  add constraint invoice_lines_quantity_check check (quantity > 0);

alter table public.invoice_lines
  drop constraint if exists invoice_lines_unit_price_check,
  add constraint invoice_lines_unit_price_check check (unit_price >= 0);

alter table public.invoice_lines
  drop constraint if exists invoice_lines_vat_rate_check,
  add constraint invoice_lines_vat_rate_check check (vat_rate in (0, 9, 21));

alter table public.invoice_lines
  drop constraint if exists invoice_lines_description_check,
  add constraint invoice_lines_description_check check (length(trim(description)) > 0);

alter table public.transactions
  drop constraint if exists transactions_amount_check,
  add constraint transactions_amount_check check (amount >= 0);

alter table public.transactions
  drop constraint if exists transactions_vat_rate_check,
  add constraint transactions_vat_rate_check check (vat_rate in (0, 9, 21));

alter table public.invoices
  drop constraint if exists invoices_due_after_issue_check,
  add constraint invoices_due_after_issue_check check (due_date is null or due_date >= issue_date);

alter table public.invoices
  drop constraint if exists invoices_number_not_blank_check,
  add constraint invoices_number_not_blank_check check (length(trim(invoice_number)) > 0);

-- ============================================================
-- 3. ATOMISCHE FACTUURNUMMERING
-- Voorkomt dubbele factuurnummers bij gelijktijdige acties (race condition).
-- Eén teller per gebruiker per jaar, opgehoogd binnen een rij-lock.
-- ============================================================

create table if not exists public.invoice_number_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  year int not null,
  next_number int not null default 1,
  primary key (user_id, year)
);

alter table public.invoice_number_counters enable row level security;

create policy "invoice_counters_select_own" on public.invoice_number_counters
  for select using (auth.uid() = user_id);
-- Geen insert/update policy voor gebruikers: uitsluitend via de
-- security-definer functie hieronder, zodat de teller niet buiten om
-- gemanipuleerd kan worden.

create or replace function public.next_invoice_number(p_year int)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_number int;
begin
  if v_user_id is null then
    raise exception 'Niet ingelogd';
  end if;

  insert into public.invoice_number_counters (user_id, year, next_number)
  values (v_user_id, p_year, 2)
  on conflict (user_id, year)
  do update set next_number = public.invoice_number_counters.next_number + 1
  returning next_number - 1 into v_number;

  return 'F-' || p_year::text || '-' || lpad(v_number::text, 3, '0');
end;
$$;

-- ============================================================
-- 4. DEFINITIEVE FACTUREN BESCHERMEN
-- Een betaalde factuur mag niet stilzwijgend gewijzigd of verwijderd worden.
-- Statuswijziging terug naar concept/verzonden blijft mogelijk (correctie),
-- maar factuurnummer, klant en factuurregels liggen vast zodra 'betaald'.
-- ============================================================

create or replace function public.protect_paid_invoice()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.status = 'betaald' then
    if tg_op = 'DELETE' then
      raise exception 'Een betaalde factuur kan niet verwijderd worden. Wijzig eerst de status.';
    end if;
    if new.invoice_number <> old.invoice_number
       or new.customer_id is distinct from old.customer_id
       or new.issue_date <> old.issue_date then
      raise exception 'Factuurnummer, klant en factuurdatum van een betaalde factuur kunnen niet gewijzigd worden.';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_protect_paid on public.invoices;
create trigger invoices_protect_paid
  before update or delete on public.invoices
  for each row execute procedure public.protect_paid_invoice();

create or replace function public.protect_paid_invoice_lines()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_status public.invoice_status;
  v_invoice_id uuid;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);
  select status into v_status from public.invoices where id = v_invoice_id;
  if v_status = 'betaald' then
    raise exception 'Regels van een betaalde factuur kunnen niet gewijzigd worden.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_lines_protect_paid on public.invoice_lines;
create trigger invoice_lines_protect_paid
  before insert or update or delete on public.invoice_lines
  for each row execute procedure public.protect_paid_invoice_lines();

-- ============================================================
-- 4b. ATOMISCH FACTUUR + REGELS OPSLAAN
-- Voorkomt dataverlies: factuur en regels worden in één transactie
-- weggeschreven. Als er iets misgaat (bv. een validatie-constraint), wordt
-- alles teruggedraaid in plaats van dat oude regels al verwijderd zijn
-- terwijl de nieuwe niet meer weggeschreven konden worden.
-- ============================================================

create or replace function public.save_invoice(
  p_id uuid,
  p_invoice_number text,
  p_customer_id uuid,
  p_status public.invoice_status,
  p_issue_date date,
  p_due_date date,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invoice_id uuid;
  v_line jsonb;
  v_sort int := 0;
begin
  if v_user_id is null then
    raise exception 'Niet ingelogd';
  end if;

  if p_id is not null then
    if not exists (select 1 from public.invoices where id = p_id and user_id = v_user_id) then
      raise exception 'Factuur niet gevonden of geen toegang';
    end if;
    update public.invoices
    set invoice_number = p_invoice_number,
        customer_id = p_customer_id,
        status = p_status,
        issue_date = p_issue_date,
        due_date = p_due_date,
        updated_at = now()
    where id = p_id;
    v_invoice_id := p_id;
    delete from public.invoice_lines where invoice_id = v_invoice_id;
  else
    insert into public.invoices (user_id, invoice_number, customer_id, status, issue_date, due_date)
    values (v_user_id, p_invoice_number, p_customer_id, p_status, p_issue_date, p_due_date)
    returning id into v_invoice_id;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    insert into public.invoice_lines (invoice_id, user_id, description, quantity, unit_price, vat_rate, sort_order)
    values (
      v_invoice_id,
      v_user_id,
      v_line->>'description',
      (v_line->>'quantity')::numeric,
      (v_line->>'unit_price')::numeric,
      (v_line->>'vat_rate')::numeric,
      v_sort
    );
    v_sort := v_sort + 1;
  end loop;

  return v_invoice_id;
end;
$$;

-- ============================================================
-- 5. STORAGE: bestandstype en -grootte beperken op de 'receipts' bucket
-- Max 10 MB, alleen afbeeldingen en pdf. (Vereist Supabase-projecten met
-- de allowed_mime_types/file_size_limit kolommen op storage.buckets —
-- aanwezig op alle huidige Supabase Cloud-projecten per 2024+. Lukt dit
-- niet via SQL, stel dit dan handmatig in via Dashboard → Storage → receipts
-- → Edit bucket.)
-- ============================================================

update storage.buckets
set
  file_size_limit = 10485760, -- 10 MB
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf']
where id = 'receipts';

-- ============================================================
-- 6. INDEXEN voor veelgebruikte queries
-- ============================================================

create index if not exists invoices_status_idx on public.invoices(user_id, status);
create index if not exists invoices_due_date_idx on public.invoices(due_date);
create index if not exists tasks_user_done_idx on public.tasks(user_id, is_done);
create index if not exists transactions_user_type_date_idx on public.transactions(user_id, type, transaction_date);
