import { createHash, timingSafeEqual } from "node:crypto";

export interface AdminCredentials {
  user: string;
  password: string;
}

const MIN_PASSWORD_LENGTH = 12;
const BASIC = /^Basic\s+([A-Za-z0-9+/=]+)$/;

/**
 * Lê as credenciais do admin do ambiente. Sem as duas variáveis, ou com senha
 * curta, devolve null e a área administrativa fica desligada.
 */
export function readAdminCredentials(
  env: Record<string, string | undefined>,
): AdminCredentials | null {
  const user = env.ADMIN_USER;
  const password = env.ADMIN_PASSWORD;
  if (!user || !password || password.length < MIN_PASSWORD_LENGTH) return null;
  return { user, password };
}

/** Compara dois textos sem revelar, pelo tempo de resposta, onde eles diferem. */
function safeEqual(a: string, b: string): boolean {
  const digest = (text: string): Buffer => createHash("sha256").update(text).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function decodeBasic(header: string | null): AdminCredentials | null {
  const encoded = header ? BASIC.exec(header.trim())?.[1] : undefined;
  if (!encoded) return null;

  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return null;
  return { user: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
}

/** Confere o cabeçalho `Authorization: Basic …` contra as credenciais configuradas. */
export function isAuthorized(header: string | null, credentials: AdminCredentials): boolean {
  const sent = decodeBasic(header);
  if (!sent) return false;

  // As duas comparações sempre rodam, para o tempo não indicar qual delas falhou.
  const userMatches = safeEqual(sent.user, credentials.user);
  const passwordMatches = safeEqual(sent.password, credentials.password);
  return userMatches && passwordMatches;
}

/**
 * Usuário autenticado do pedido, ou null. As ações do admin chamam isto de novo,
 * mesmo já tendo passado pelo proxy, para não depender de uma única barreira.
 */
export function authenticatedAdmin(
  header: string | null,
  env: Record<string, string | undefined>,
): string | null {
  const credentials = readAdminCredentials(env);
  if (!credentials || !isAuthorized(header, credentials)) return null;
  return credentials.user;
}
