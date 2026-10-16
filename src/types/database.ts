export type InvoiceStatus = "concept" | "verzonden" | "betaald" | "te_laat";
export type TransactionType = "inkomst" | "uitgave";
export type TaskType = "handmatig" | "ontbrekend_bonnetje" | "factuur_te_laat";

export interface Profile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  kvk_number: string | null;
  vat_number: string | null;
  address: string | null;
  iban: string | null;
  email: string | null;
  phone: string | null;
  invoice_footer: string | null;
}

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  address: string | null;
  vat_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  customer_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  sent_at: string | null;
  sent_to_email: string | null;
  send_error: string | null;
  customers?: Pick<Customer, "id" | "name" | "company_name" | "email" | "address" | "vat_number"> | null;
  invoice_lines?: InvoiceLine[];
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  sort_order: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  category: string;
  description: string | null;
  amount: number;
  vat_rate: number;
  transaction_date: string;
  invoice_id: string | null;
  created_at: string;
  receipts?: Receipt[];
}

export interface Receipt {
  id: string;
  user_id: string;
  transaction_id: string | null;
  file_path: string;
  file_name: string;
  uploaded_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  type: TaskType;
  related_invoice_id: string | null;
  related_transaction_id: string | null;
  is_done: boolean;
  created_at: string;
}
