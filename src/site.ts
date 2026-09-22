import type { Locale } from "./profile.js";

const viteEnvironment = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const nodeEnvironment = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env;

export const siteOrigin = (viteEnvironment?.PUBLIC_SITE_ORIGIN ?? nodeEnvironment?.PUBLIC_SITE_ORIGIN ?? "https://resumilio.danienremoto.com").replace(/\/+$/, "");
export const siteBase = (viteEnvironment?.PUBLIC_SITE_BASE ?? nodeEnvironment?.PUBLIC_SITE_BASE ?? "").replace(/^\/*|\/*$/g, "");

export function withBase(path: string): string {
  if (!path.startsWith("/")) throw new Error(`Expected a site-relative path: ${path}`);
  if (!siteBase) return path;
  const prefix = `/${siteBase}`;
  return path === prefix || path.startsWith(`${prefix}/`) ? path : `${prefix}${path}`;
}

export function localeRoot(locale: Locale): string {
  return withBase(locale === "en" ? "/" : "/es/");
}

export function claimPath(claimId: string, locale: Locale): string {
  return withBase(locale === "en" ? `/evidence/${claimId}/` : `/es/evidencia/${claimId}/`);
}

export function classicPath(locale: Locale): string {
  return withBase(locale === "en" ? "/classic/" : "/es/clasico/");
}

export function classicClaimPath(claimId: string, locale: Locale): string {
  return `${classicPath(locale)}#${claimId}`;
}

export function classicEvidencePath(evidenceId: string, locale: Locale): string {
  return `${classicPath(locale)}#${evidenceId}`;
}

export function localizedPath(path: string, locale: Locale): string {
  return withBase(locale === "en" ? path : `/es${path}`);
}

export function absoluteUrl(path: string): string {
  return new URL(withBase(path), `${siteOrigin}/`).toString();
}
