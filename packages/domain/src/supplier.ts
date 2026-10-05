import { normalizeName, onlyDigits } from "./parse";

export type SupplierDocumentType = "cnpj" | "cpf" | "unknown";

export interface ParsedSupplier {
  documentType: SupplierDocumentType;
  /** CNPJ só com dígitos, CPF sempre mascarado, ou null quando a fonte não publica. */
  documentNumber: string | null;
  isDocumentMasked: boolean;
  legalName: string;
  nameNormalized: string;
}

const CNPJ_LENGTH = 14;
const CPF_LENGTH = 11;
const LABEL = /^([\d./*-]*?)\s*-\s+(.*)$|^([\d./*-]*)-$/s;

/** O CPF completo nunca sai deste módulo: apenas os seis dígitos centrais são mantidos. */
function maskCpf(digits: string): string {
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

/**
 * Identifica um fornecedor a partir do documento e do nome publicados em
 * colunas separadas. Documento com asteriscos já veio mascarado pela fonte e é
 * mantido como publicado; CPF completo é mascarado aqui.
 */
export function parseCreditor(rawDocument: string, name: string): ParsedSupplier {
  const legalName = name.trim();
  if (legalName === "") {
    throw new Error("Fornecedor sem nome.");
  }
  const document = rawDocument.trim();
  const digits = onlyDigits(document);
  const base = { legalName, nameNormalized: normalizeName(legalName) };

  if (document.includes("*")) {
    return { ...base, documentType: "cpf", documentNumber: document, isDocumentMasked: true };
  }
  if (digits.length === CNPJ_LENGTH) {
    return { ...base, documentType: "cnpj", documentNumber: digits, isDocumentMasked: false };
  }
  if (digits.length === CPF_LENGTH) {
    return { ...base, documentType: "cpf", documentNumber: maskCpf(digits), isDocumentMasked: true };
  }
  return { ...base, documentType: "unknown", documentNumber: null, isDocumentMasked: false };
}

/**
 * Interpreta o rótulo de fornecedor publicado pelo SIGER, no formato
 * "<documento> - <nome>". O documento pode vir vazio.
 */
export function parseSupplierLabel(label: string): ParsedSupplier {
  const match = LABEL.exec(label.trim());
  const rawDocument = match?.[1] ?? "";
  const legalName = (match ? (match[2] ?? "") : label).trim();

  if (legalName === "") {
    throw new Error(`Fornecedor sem nome no rótulo: "${label}"`);
  }
  return parseCreditor(rawDocument, legalName);
}
