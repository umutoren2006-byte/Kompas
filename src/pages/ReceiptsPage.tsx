import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, FileText, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Receipt, Transaction } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";

export function ReceiptsPage() {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [linkTransactionId, setLinkTransactionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      void loadReceipts(user.id);
      void loadTransactions(user.id);
    }
  }, [user]);

  async function loadReceipts(userId: string) {
    setLoading(true);
    const { data } = await supabase
      .from("receipts")
      .select("*")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false });
    setReceipts(data ?? []);
    setLoading(false);
  }

  async function loadTransactions(userId: string) {
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "uitgave")
      .order("transaction_date", { ascending: false });
    setTransactions(data ?? []);
  }

  const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic", "application/pdf"];
  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, moet overeenkomen met de bucket-limiet in de migratie

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Alleen afbeeldingen (png, jpg, webp, heic) of pdf-bestanden zijn toegestaan.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Bestand is te groot. Maximaal 10 MB per bonnetje.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    setError(null);

    // Bestandsnaam saneren: alleen veilige tekens, zodat de storage-path
    // (user_id/bestandsnaam) niet door rare tekens kan breken.
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${user.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("receipts").upload(path, file);

    if (uploadError) {
      setUploading(false);
      setError(
        uploadError.message.includes("Bucket not found")
          ? "De 'receipts' opslag-bucket bestaat nog niet in dit Supabase-project. Voer de migratie uit (supabase/migrations/0001_init.sql)."
          : uploadError.message
      );
      return;
    }

    const { error: insertError } = await supabase.from("receipts").insert({
      user_id: user.id,
      transaction_id: linkTransactionId || null,
      file_path: path,
      file_name: file.name,
    });

    setUploading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    void loadReceipts(user.id);
  }

  async function handleDelete(receipt: Receipt) {
    if (!user) return;
    if (!confirm(`Bonnetje "${receipt.file_name}" verwijderen?`)) return;
    await supabase.storage.from("receipts").remove([receipt.file_path]);
    await supabase.from("receipts").delete().eq("id", receipt.id);
    void loadReceipts(user.id);
  }

  async function handleOpen(receipt: Receipt) {
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(receipt.file_path, 60);
    if (error || !data) {
      alert("Kon het bestand niet openen.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  function isImage(name: string) {
    return /\.(png|jpe?g|gif|webp)$/i.test(name);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Bonnetjes</h1>
      <p className="mt-1 text-sm text-slate-500">Upload en koppel bonnetjes aan uitgaven</p>

      <Card className="mt-6">
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Koppel aan uitgave (optioneel)
            </label>
            <Select
              value={linkTransactionId}
              onChange={(e) => setLinkTransactionId(e.target.value)}
            >
              <option value="">Geen koppeling</option>
              {transactions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.description || t.category} — {formatDate(t.transaction_date)}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-6 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600">
            <Upload size={18} />
            {uploading ? "Uploaden..." : "Klik om een bonnetje te uploaden (afbeelding of pdf)"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <div className="mt-6 space-y-2">
        {loading && <p className="text-sm text-slate-400">Laden...</p>}
        {!loading && receipts.length === 0 && (
          <Card>
            <CardContent className="text-center text-sm text-slate-500">
              Nog geen bonnetjes geüpload.
            </CardContent>
          </Card>
        )}
        {receipts.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex items-center justify-between gap-4">
              <button
                onClick={() => handleOpen(r)}
                className="flex min-w-0 items-center gap-3 text-left"
              >
                {isImage(r.file_name) ? (
                  <ImageIcon className="shrink-0 text-indigo-500" size={20} />
                ) : (
                  <FileText className="shrink-0 text-indigo-500" size={20} />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{r.file_name}</p>
                  <p className="text-sm text-slate-500">{formatDate(r.uploaded_at)}</p>
                </div>
              </button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(r)}>
                <Trash2 size={15} className="text-red-500" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
