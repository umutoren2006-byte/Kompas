-- Kompas: fase 3 — factuurgegevens voor PDF/e-mail
-- Bouwt voort op 0001_init.sql en 0002_hardening.sql.

-- ============================================================
-- 1. BETALINGSGEGEVENS op het profiel
-- Nodig om een factuur-PDF met correcte afzendergegevens en IBAN te tonen.
-- ============================================================

alter table public.profiles
  add column if not exists iban text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists invoice_footer text;

-- ============================================================
-- 2. sent_at / betaalgegevens op facturen
-- Zodat we weten wanneer een factuur daadwerkelijk per e-mail verstuurd is
-- (los van de handmatige status "verzonden"), en zodat verwijderingen van
-- resultaat van een poging tot verzenden traceerbaar zijn.
-- ============================================================

alter table public.invoices
  add column if not exists sent_at timestamptz,
  add column if not exists sent_to_email text,
  add column if not exists send_error text;

-- ============================================================
-- 3. RPC om de status naar 'verzonden' te zetten NA succesvolle e-mail
-- Wordt aangeroepen door de edge function (met de JWT van de ingelogde
-- gebruiker, dus gewoon onder RLS) na een geslaagde verzending. Ook los
-- bruikbaar voor "markeer als verzonden" zonder e-mail.
-- ============================================================

create or replace function public.mark_invoice_sent(
  p_invoice_id uuid,
  p_sent_to_email text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Niet ingelogd';
  end if;

  update public.invoices
  set status = case when status = 'concept' then 'verzonden' else status end,
      sent_at = now(),
      sent_to_email = p_sent_to_email,
      send_error = null
  where id = p_invoice_id and user_id = v_user_id;

  if not found then
    raise exception 'Factuur niet gevonden of geen toegang';
  end if;
end;
$$;

-- ============================================================
-- 4. RPC om een mislukte verzendpoging vast te leggen
-- Wordt aangeroepen door de edge function wanneer Resend een fout teruggeeft,
-- zodat de gebruiker dit in de facturenlijst te zien krijgt in plaats van
-- dat de poging stilzwijgend verdwijnt. Wijzigt de status niet.
-- ============================================================

create or replace function public.record_invoice_send_error(
  p_invoice_id uuid,
  p_error text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Niet ingelogd';
  end if;

  update public.invoices
  set send_error = p_error
  where id = p_invoice_id and user_id = v_user_id;

  if not found then
    raise exception 'Factuur niet gevonden of geen toegang';
  end if;
end;
$$;
