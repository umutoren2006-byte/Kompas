// Supabase Edge Function: send-invoice
//
// Ontvangt een factuur-id plus de al client-side gegenereerde PDF (als
// base64), stuurt deze per e-mail naar de klant via Resend, en registreert
// het resultaat op de factuur (sent_at/sent_to_email of send_error) via de
// `mark_invoice_sent` RPC.
//
// Waarom de PDF niet hier wordt gegenereerd: @react-pdf/renderer is een
// Node-gerichte library die niet betrouwbaar draait in de Deno edge-runtime.
// De PDF-generatie (src/lib/InvoicePdf.tsx) is al in de browser getest en
// geverifieerd (zie README "Hoe fase 3 is getest"); deze functie hergebruikt
// die output in plaats van de layout-logica te dupliceren in Deno.
//
// Beveiliging:
// - Deze functie gebruikt de Authorization-header van de ingelogde gebruiker
//   (niet de service-role key), zodat alle database-acties onderhevig
//   blijven aan Row Level Security — een gebruiker kan dus nooit andermans
//   factuur versturen, ook niet door een ander invoice_id mee te sturen.
// - De klant-e-mail wordt NIET door de client meegegeven; deze functie haalt
//   die zelf op uit de database (customers.email), zodat een gemanipuleerd
//   verzoek nooit naar een door de aanroeper gekozen adres kan mailen.
// - RESEND_API_KEY staat alleen als Supabase secret, nooit in de frontend of
//   in git (zie README voor deploy-instructies).

import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
// Verzendadres: standaard Resend-testdomein, overschrijfbaar via secret zodra
// de gebruiker een eigen domein bij Resend heeft geverifieerd.
const FROM_EMAIL = Deno.env.get("SEND_INVOICE_FROM_EMAIL") ?? "Kompas <onboarding@resend.dev>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResponse(
      { error: "Server niet correct geconfigureerd (ontbrekende secrets). Zie README." },
      500
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Niet ingelogd." }, 401);
  }

  let invoiceId: string;
  let pdfBase64: string;
  try {
    const body = await req.json();
    invoiceId = String(body.invoice_id ?? "");
    pdfBase64 = String(body.pdf_base64 ?? "");
    if (!invoiceId || !pdfBase64) {
      return jsonResponse({ error: "invoice_id en pdf_base64 zijn verplicht." }, 400);
    }
  } catch {
    return jsonResponse({ error: "Ongeldige aanvraag." }, 400);
  }

  // Client gebonden aan de JWT van de ingelogde gebruiker: alle queries
  // hieronder lopen door RLS, dus deze functie kan nooit data van een andere
  // gebruiker lezen of wijzigen, ongeacht wat er in de request body staat.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Niet ingelogd." }, 401);
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, invoice_number, customers(email, name, company_name)")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return jsonResponse({ error: "Factuur niet gevonden of geen toegang." }, 404);
  }

  const customer = invoice.customers as unknown as {
    email: string | null;
    name: string;
    company_name: string | null;
  } | null;

  if (!customer?.email) {
    return jsonResponse({ error: "Deze klant heeft geen e-mailadres." }, 400);
  }

  const recipientName = customer.company_name || customer.name;

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [customer.email],
        subject: `Factuur ${invoice.invoice_number}`,
        html: `<p>Beste ${recipientName},</p><p>Bijgevoegd vind je factuur ${invoice.invoice_number}.</p><p>Met vriendelijke groet</p>`,
        attachments: [
          {
            filename: `${invoice.invoice_number}.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      throw new Error(`Resend-fout (${resendResponse.status}): ${errText}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout bij versturen.";
    // Fout vastleggen op de factuur zodat de gebruiker dit in de UI ziet.
    await supabase.rpc("record_invoice_send_error", {
      p_invoice_id: invoiceId,
      p_error: message,
    });
    return jsonResponse({ error: message }, 502);
  }

  const { error: markError } = await supabase.rpc("mark_invoice_sent", {
    p_invoice_id: invoiceId,
    p_sent_to_email: customer.email,
  });

  if (markError) {
    // E-mail is wel verstuurd, maar status kon niet worden bijgewerkt — meld
    // dit expliciet in plaats van stilzwijgend succes te claimen.
    return jsonResponse(
      { error: `E-mail verstuurd, maar status bijwerken mislukt: ${markError.message}` },
      500
    );
  }

  return jsonResponse({ success: true, sent_to: customer.email });
});
