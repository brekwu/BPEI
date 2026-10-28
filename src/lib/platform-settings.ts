import { createContext, useContext, type ReactNode, createElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SITE } from "./site-content";


// Shape of the platform-wide public settings (SSOT). Every field is optional so
// unset values fall back to sensible defaults from site-content.
export interface PlatformPublicSettings {
  identity?: {
    legal_name?: string | null;
    commercial_name?: string | null;
    legal_form?: string | null;
    siren?: string | null;
    rcs?: string | null;
    vat?: string | null;
    publication_director?: string | null;
    tagline?: string | null;
  };
  contact?: {
    email?: string | null;
    support_email?: string | null;
    legal_email?: string | null;
    complaint_email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  hosting?: {
    host_name?: string | null;
    host_address?: string | null;
  };
  mediator?: {
    name?: string | null;
    website?: string | null;
    address?: string | null;
    scope?: string | null;
  };
  social?: {
    linkedin?: string | null;
    x?: string | null;
    instagram?: string | null;
    facebook?: string | null;
    youtube?: string | null;
  };
  seo?: {
    default_title?: string | null;
    default_description?: string | null;
  };
  beta?: {
    end_date?: string | null;
    banner?: string | null;
  };
}

export interface PlatformSettingsPublication {
  id: string;
  version: number;
  snapshot: PlatformPublicSettings;
  changed_fields: string[];
  note: string | null;
  status: "pending" | "publishing" | "published" | "partially_failed" | "failed" | "rolled_back";
  published_by: string | null;
  published_at: string;
  rollback_of: string | null;
}

export interface OwnerPlatformSettingsPayload {
  draft: PlatformPublicSettings;
  published: PlatformPublicSettings;
  published_version: number;
  draft_updated_at: string | null;
  published_at: string | null;
  publications: PlatformSettingsPublication[];
}

// Merge published settings with site-content defaults so callers always have a value.
export function mergeWithDefaults(s: PlatformPublicSettings | null | undefined) {
  const p = s ?? {};
  return {
    identity: {
      legal_name: p.identity?.legal_name ?? SITE.legal.editorName,
      commercial_name: p.identity?.commercial_name ?? SITE.name,
      legal_form: p.identity?.legal_form ?? SITE.legal.legalForm,
      siren: p.identity?.siren ?? SITE.legal.siren,
      rcs: p.identity?.rcs ?? SITE.legal.rcs,
      vat: p.identity?.vat ?? SITE.legal.vat,
      publication_director: p.identity?.publication_director ?? SITE.legal.publicationDirector,
      tagline: p.identity?.tagline ?? SITE.tagline,
    },
    contact: {
      email: p.contact?.email ?? SITE.contact.email,
      support_email: p.contact?.support_email ?? p.contact?.email ?? SITE.contact.email,
      legal_email: p.contact?.legal_email ?? p.contact?.email ?? SITE.contact.email,
      complaint_email: p.contact?.complaint_email ?? p.contact?.email ?? SITE.contact.email,
      phone: p.contact?.phone ?? SITE.contact.phone,
      address: p.contact?.address ?? SITE.contact.address ?? SITE.legal.address,
    },
    hosting: {
      host_name: p.hosting?.host_name ?? SITE.legal.hostName,
      host_address: p.hosting?.host_address ?? SITE.legal.hostAddress,
    },
    mediator: {
      name: p.mediator?.name ?? SITE.mediator.name,
      website: p.mediator?.website ?? SITE.mediator.website,
      address: p.mediator?.address ?? SITE.mediator.address,
      scope: p.mediator?.scope ?? SITE.mediator.scope,
    },
    social: {
      linkedin: p.social?.linkedin ?? null,
      x: p.social?.x ?? null,
      instagram: p.social?.instagram ?? null,
      facebook: p.social?.facebook ?? null,
      youtube: p.social?.youtube ?? null,
    },
    seo: {
      default_title: p.seo?.default_title ?? null,
      default_description: p.seo?.default_description ?? null,
    },
    beta: {
      end_date: p.beta?.end_date ?? null,
      banner: p.beta?.banner ?? SITE.betaBanner,
    },
  };
}

export type ResolvedPlatformSettings = ReturnType<typeof mergeWithDefaults>;

// Isolated preview context — used ONLY by the owner preview route. When set,
// consumers see the draft values instead of the currently-published ones.
// Anonymous / public navigation never mounts this provider, so drafts never
// leak out of the owner preview tree.
const PreviewSettingsContext = createContext<PlatformPublicSettings | null>(null);

export function PreviewSettingsProvider({
  draft,
  children,
}: {
  draft: PlatformPublicSettings;
  children: ReactNode;
}) {
  return createElement(PreviewSettingsContext.Provider, { value: draft }, children);
}

// Public hook — reads the currently published settings (safe for anonymous visitors).
// When mounted inside PreviewSettingsProvider, returns the draft override instead
// (without touching the shared query cache).
export function usePlatformSettings() {
  const preview = useContext(PreviewSettingsContext);
  const query = useQuery({
    queryKey: ["platform-public-settings"],
    queryFn: async (): Promise<PlatformPublicSettings> => {
      const { data, error } = await supabase.rpc("get_public_platform_settings");
      if (error) throw error;
      return (data as PlatformPublicSettings | null) ?? {};
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: preview === null,
  });
  const effective = preview ?? query.data;
  return {
    ...query,
    isPreview: preview !== null,
    settings: mergeWithDefaults(effective),
  };
}