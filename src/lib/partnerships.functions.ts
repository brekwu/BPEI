import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// -------- Opportunités (côté boutique) --------
export const listMyOpportunities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("partner_opportunities").select("*")
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id?: string; shopId: string; title: string; description?: string;
    specialties?: string[]; covered_cities?: string[]; covered_postal_codes?: string[];
    compensation_model?: string; compensation_details?: string;
    requires_exclusivity?: boolean; min_availability?: string;
    expires_at?: string | null;
    status?: "draft" | "published" | "paused" | "closed" | "filled";
  }) => z.object({
    id: uuid.optional(),
    shopId: uuid,
    title: z.string().min(3).max(200),
    description: z.string().max(4000).optional(),
    specialties: z.array(z.string().max(80)).max(20).optional(),
    covered_cities: z.array(z.string().max(80)).max(50).optional(),
    covered_postal_codes: z.array(z.string().max(10)).max(50).optional(),
    compensation_model: z.string().max(80).optional(),
    compensation_details: z.string().max(1000).optional(),
    requires_exclusivity: z.boolean().optional(),
    min_availability: z.string().max(200).optional(),
    expires_at: z.string().nullable().optional(),
    status: z.enum(["draft","published","paused","closed","filled"]).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const payload = {
      shop_id: data.shopId,
      title: data.title,
      description: data.description ?? null,
      specialties: data.specialties ?? [],
      covered_cities: data.covered_cities ?? [],
      covered_postal_codes: data.covered_postal_codes ?? [],
      compensation_model: data.compensation_model ?? null,
      compensation_details: data.compensation_details ?? null,
      requires_exclusivity: data.requires_exclusivity ?? false,
      min_availability: data.min_availability ?? null,
      expires_at: data.expires_at ?? null,
      status: data.status ?? "draft",
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("partner_opportunities").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("partner_opportunities").insert({ ...payload, created_by: context.userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const setOpportunityStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; status: "draft"|"published"|"paused"|"closed"|"filled" }) =>
    z.object({ id: uuid, status: z.enum(["draft","published","paused","closed","filled"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("partner_opportunities").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("partner_opportunities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Candidatures reçues (côté boutique) --------
export const listApplicationsForShop = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: opps } = await context.supabase
      .from("partner_opportunities").select("id, title").eq("shop_id", data.shopId);
    const oppIds = (opps ?? []).map((o) => o.id);
    if (oppIds.length === 0) return [];
    const { data: apps, error } = await context.supabase
      .from("partner_applications")
      .select("*")
      .in("opportunity_id", oppIds)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const indepIds = Array.from(new Set((apps ?? []).map((a) => a.independent_shop_id)));
    const { data: shops } = indepIds.length
      ? await context.supabase.from("shops")
          .select("id, name, public_name, city, email, phone, verification_status")
          .in("id", indepIds)
      : { data: [] as any[] };
    const oppMap = new Map((opps ?? []).map((o) => [o.id, o.title]));
    const shopMap = new Map((shops ?? []).map((s: any) => [s.id, s]));
    return (apps ?? []).map((a) => ({
      ...a,
      opportunity_title: oppMap.get(a.opportunity_id) ?? "—",
      independent: shopMap.get(a.independent_shop_id) ?? null,
    }));
  });

export const acceptApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    applicationId: string; title: string; scope?: string;
    compensation_model?: string; compensation_details?: string;
    requires_exclusivity?: boolean; start_date?: string; end_date?: string;
  }) => z.object({
    applicationId: uuid,
    title: z.string().min(3).max(200),
    scope: z.string().max(2000).optional(),
    compensation_model: z.string().max(80).optional(),
    compensation_details: z.string().max(2000).optional(),
    requires_exclusivity: z.boolean().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("partner_accept_application", {
      _application_id: data.applicationId,
      _title: data.title,
      _scope: data.scope,
      _compensation_model: data.compensation_model,
      _compensation_details: data.compensation_details,
      _requires_exclusivity: data.requires_exclusivity ?? false,
      _start_date: data.start_date,
      _end_date: data.end_date,
    });
    if (error) throw new Error(error.message);
    return { agreementId: id as string };
  });

export const rejectApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { applicationId: string; notes?: string }) =>
    z.object({ applicationId: uuid, notes: z.string().max(2000).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("partner_reject_application", {
      _application_id: data.applicationId, _notes: data.notes,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Opportunités disponibles (côté indépendant) --------
export const listAvailableOpportunities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: opps, error } = await context.supabase
      .from("partner_opportunities")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const shopIds = Array.from(new Set((opps ?? []).map((o) => o.shop_id)));
    const { data: shops } = shopIds.length
      ? await context.supabase.from("shops")
          .select("id, name, public_name, city, verification_status, business_type")
          .in("id", shopIds)
      : { data: [] as any[] };
    const map = new Map((shops ?? []).map((s: any) => [s.id, s]));
    return (opps ?? []).map((o) => ({ ...o, shop: map.get(o.shop_id) ?? null }));
  });

export const listMyApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { independentShopId: string }) =>
    z.object({ independentShopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: apps, error } = await context.supabase
      .from("partner_applications").select("*")
      .eq("independent_shop_id", data.independentShopId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const oppIds = Array.from(new Set((apps ?? []).map((a) => a.opportunity_id)));
    const { data: opps } = oppIds.length
      ? await context.supabase.from("partner_opportunities")
          .select("id, title, shop_id").in("id", oppIds)
      : { data: [] as any[] };
    const shopIds = Array.from(new Set((opps ?? []).map((o: any) => o.shop_id)));
    const { data: shops } = shopIds.length
      ? await context.supabase.from("shops").select("id, name, public_name, city").in("id", shopIds)
      : { data: [] as any[] };
    const oppMap = new Map((opps ?? []).map((o: any) => [o.id, o]));
    const shopMap = new Map((shops ?? []).map((s: any) => [s.id, s]));
    return (apps ?? []).map((a) => {
      const o = oppMap.get(a.opportunity_id) as any;
      return { ...a, opportunity: o ?? null, shop: o ? shopMap.get(o.shop_id) : null };
    });
  });

export const applyToOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { opportunityId: string; independentShopId: string; message?: string; proposedRate?: string }) =>
    z.object({
      opportunityId: uuid, independentShopId: uuid,
      message: z.string().max(2000).optional(),
      proposedRate: z.string().max(200).optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("partner_apply", {
      _opportunity_id: data.opportunityId,
      _independent_shop_id: data.independentShopId,
      _message: data.message,
      _proposed_rate: data.proposedRate,
    });
    if (error) throw new Error(error.message);
    return { applicationId: id as string };
  });

export const withdrawApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { applicationId: string }) =>
    z.object({ applicationId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("partner_withdraw_application", {
      _application_id: data.applicationId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Accords --------
export const listAgreementsForShop = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("partner_agreements").select("*")
      .or(`shop_id.eq.${data.shopId},independent_shop_id.eq.${data.shopId}`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set([
      ...(rows ?? []).map((r) => r.shop_id),
      ...(rows ?? []).map((r) => r.independent_shop_id),
    ]));
    const { data: shops } = ids.length
      ? await context.supabase.from("shops").select("id, name, public_name, city, business_type").in("id", ids)
      : { data: [] as any[] };
    const map = new Map((shops ?? []).map((s: any) => [s.id, s]));
    return (rows ?? []).map((r) => ({
      ...r,
      shop: map.get(r.shop_id) ?? null,
      independent: map.get(r.independent_shop_id) ?? null,
    }));
  });

export const signAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { agreementId: string }) =>
    z.object({ agreementId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("partner_sign_agreement", {
      _agreement_id: data.agreementId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const terminateAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { agreementId: string; reason?: string }) =>
    z.object({ agreementId: uuid, reason: z.string().max(2000).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("partner_terminate_agreement", {
      _agreement_id: data.agreementId, _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Sous-lot 5 : versionnage & signatures --------
export const markApplicationViewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { applicationId: string }) =>
    z.object({ applicationId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("partner_mark_application_viewed", {
      _application_id: data.applicationId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const shortlistApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { applicationId: string }) =>
    z.object({ applicationId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("partner_shortlist_application", {
      _application_id: data.applicationId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAgreementVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { agreementId: string }) =>
    z.object({ agreementId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("partner_agreement_versions").select("*")
      .eq("agreement_id", data.agreementId)
      .order("version_number", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const proposeAgreementVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { agreementId: string; snapshot: Record<string, unknown>; changeSummary?: string }) =>
    z.object({
      agreementId: uuid,
      snapshot: z.record(z.string(), z.unknown()),
      changeSummary: z.string().max(2000).optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: v, error } = await context.supabase.rpc("partner_propose_agreement_version", {
      _agreement_id: data.agreementId,
      _snapshot: data.snapshot as any,
      _change_summary: data.changeSummary,
    });
    if (error) throw new Error(error.message);
    return { versionNumber: v as number };
  });

export const acceptAgreementVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { agreementId: string; versionNumber: number; contentHash: string }) =>
    z.object({
      agreementId: uuid,
      versionNumber: z.number().int().positive(),
      contentHash: z.string().min(10).max(200),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: status, error } = await context.supabase.rpc("partner_accept_agreement_version", {
      _agreement_id: data.agreementId,
      _version_number: data.versionNumber,
      _content_hash: data.contentHash,
    });
    if (error) throw new Error(error.message);
    return { status: status as string };
  });

export const ownerSuspendAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { agreementId: string; reason: string }) =>
    z.object({ agreementId: uuid, reason: z.string().min(3).max(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("partner_owner_suspend_agreement", {
      _agreement_id: data.agreementId, _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Sous-lot 5-bis : PDF, diff, conflits --------
export const getAgreementVersionPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { agreementId: string; versionNumber: number }) =>
    z.object({ agreementId: uuid, versionNumber: z.number().int().positive() }).parse(i))
  .handler(async ({ data, context }) => {
    // RLS on partner_agreements gates visibility; a version row is unreachable if the parent isn't.
    const { data: agr, error: agrErr } = await context.supabase
      .from("partner_agreements")
      .select("id, shop_id, independent_shop_id, became_active_at")
      .eq("id", data.agreementId)
      .single();
    if (agrErr || !agr) throw new Error("Accord introuvable.");
    const { data: ver, error: verErr } = await context.supabase
      .from("partner_agreement_versions")
      .select("*")
      .eq("agreement_id", data.agreementId)
      .eq("version_number", data.versionNumber)
      .single();
    if (verErr || !ver) throw new Error("Version introuvable.");
    const { data: shops } = await context.supabase
      .from("shops")
      .select("id, name, public_name, city, siret, email")
      .in("id", [agr.shop_id, agr.independent_shop_id]);
    const shopMap = new Map((shops ?? []).map((s: any) => [s.id, s]));
    const s = shopMap.get(agr.shop_id) as any;
    const ind = shopMap.get(agr.independent_shop_id) as any;

    const { renderAgreementPdfBase64 } = await import("@/lib/pdf/agreement.server");
    const base64 = await renderAgreementPdfBase64({
      agreementId: agr.id,
      versionNumber: ver.version_number,
      contentHash: ver.content_hash,
      createdAt: ver.created_at,
      changeSummary: ver.change_summary,
      snapshot: ver.snapshot as any,
      shop: { name: s?.public_name || s?.name, city: s?.city, siret: s?.siret, email: s?.email },
      independent: { name: ind?.public_name || ind?.name, city: ind?.city, siret: ind?.siret, email: ind?.email },
      shopAcceptedAt: ver.shop_accepted_at,
      independentAcceptedAt: ver.independent_accepted_at,
      becameActiveAt: ver.became_active_at ?? agr.became_active_at,
    });
    return { base64, filename: `accord-${agr.id.slice(0, 8)}-v${ver.version_number}.pdf` };
  });

export const diffAgreementVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { agreementId: string; fromVersion: number; toVersion: number }) =>
    z.object({
      agreementId: uuid,
      fromVersion: z.number().int().positive(),
      toVersion: z.number().int().positive(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("partner_agreement_versions")
      .select("version_number, snapshot, content_hash, created_at, change_summary")
      .eq("agreement_id", data.agreementId)
      .in("version_number", [data.fromVersion, data.toVersion]);
    if (error) throw new Error(error.message);
    const from = rows?.find((r) => r.version_number === data.fromVersion);
    const to = rows?.find((r) => r.version_number === data.toVersion);
    if (!from || !to) throw new Error("Versions introuvables.");
    const keys = new Set<string>([
      ...Object.keys((from.snapshot as any) ?? {}),
      ...Object.keys((to.snapshot as any) ?? {}),
    ]);
    const norm = (v: unknown) =>
      v == null || v === "" || (Array.isArray(v) && v.length === 0) ? null : v;
    const changes: Array<{ key: string; before: string; after: string }> = [];
    const stringify = (v: unknown) => v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    for (const k of keys) {
      const a = norm((from.snapshot as any)?.[k]);
      const b = norm((to.snapshot as any)?.[k]);
      if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ key: k, before: stringify(a), after: stringify(b) });
    }
    return {
      from: { version: from.version_number, hash: from.content_hash, createdAt: from.created_at, summary: from.change_summary },
      to: { version: to.version_number, hash: to.content_hash, createdAt: to.created_at, summary: to.change_summary },
      changes,
    };
  });

export const checkAgreementConflicts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string;
    excludeAgreementId?: string;
    snapshot: {
      start_date?: string | null;
      end_date?: string | null;
      specialties?: string[] | null;
      covered_cities?: string[] | null;
      covered_postal_codes?: string[] | null;
      exclusivity_kind?: string | null;
    };
  }) => z.object({
    shopId: uuid,
    excludeAgreementId: uuid.optional(),
    snapshot: z.object({
      start_date: z.string().nullable().optional(),
      end_date: z.string().nullable().optional(),
      specialties: z.array(z.string()).nullable().optional(),
      covered_cities: z.array(z.string()).nullable().optional(),
      covered_postal_codes: z.array(z.string()).nullable().optional(),
      exclusivity_kind: z.string().nullable().optional(),
    }),
  }).parse(i))
  .handler(async ({ data, context }) => {
    // Only look at agreements the caller can already see via RLS on the shop side they belong to.
    const { data: rows, error } = await context.supabase
      .from("partner_agreements")
      .select("id, title, status, start_date, end_date, current_version, shop_id, independent_shop_id, exclusivity_kind")
      .or(`shop_id.eq.${data.shopId},independent_shop_id.eq.${data.shopId}`)
      .in("status", ["active", "proposed", "shop_signed", "independent_signed", "negotiation"]);
    if (error) throw new Error(error.message);
    const others = (rows ?? []).filter((r) => r.id !== data.excludeAgreementId);
    if (others.length === 0) return { conflicts: [] as any[] };

    const versionRows = await context.supabase
      .from("partner_agreement_versions")
      .select("agreement_id, version_number, snapshot")
      .in("agreement_id", others.map((o) => o.id));
    const snapByAgr = new Map<string, any>();
    for (const v of versionRows.data ?? []) {
      const cur = others.find((o) => o.id === v.agreement_id)?.current_version ?? 1;
      if (v.version_number === cur) snapByAgr.set(v.agreement_id, v.snapshot);
    }

    const ownStart = data.snapshot.start_date ? new Date(data.snapshot.start_date).getTime() : -Infinity;
    const ownEnd = data.snapshot.end_date ? new Date(data.snapshot.end_date).getTime() : Infinity;
    const ownSpec = new Set((data.snapshot.specialties ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean));
    const ownCity = new Set((data.snapshot.covered_cities ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean));
    const ownCp = new Set((data.snapshot.covered_postal_codes ?? []).map((s) => s.trim()).filter(Boolean));
    const ownExcl = (data.snapshot.exclusivity_kind ?? "none").toLowerCase();

    const conflicts: Array<{
      agreementId: string; title: string; status: string;
      overlapPeriod: boolean; sharedServices: string[]; sharedCities: string[]; sharedPostalCodes: string[];
      exclusivityConflict: boolean; severity: "high" | "medium" | "low";
    }> = [];

    for (const other of others) {
      const snap = snapByAgr.get(other.id) ?? {};
      const oStart = snap.start_date ? new Date(snap.start_date).getTime()
        : other.start_date ? new Date(other.start_date).getTime() : -Infinity;
      const oEnd = snap.end_date ? new Date(snap.end_date).getTime()
        : other.end_date ? new Date(other.end_date).getTime() : Infinity;
      const overlapPeriod = ownStart <= oEnd && oStart <= ownEnd;

      const oSpec = new Set((snap.specialties ?? []).map((s: string) => s.toLowerCase().trim()).filter(Boolean));
      const oCity = new Set((snap.covered_cities ?? []).map((s: string) => s.toLowerCase().trim()).filter(Boolean));
      const oCp = new Set((snap.covered_postal_codes ?? []).map((s: string) => s.trim()).filter(Boolean));
      const oExcl = (snap.exclusivity_kind ?? other.exclusivity_kind ?? "none").toLowerCase();

      const sharedServices = [...ownSpec].filter((x) => oSpec.has(x));
      const sharedCities = [...ownCity].filter((x) => oCity.has(x));
      const sharedPostalCodes = [...ownCp].filter((x) => oCp.has(x));

      const overlaps = sharedServices.length > 0 || sharedCities.length > 0 || sharedPostalCodes.length > 0;
      const geoOrService = overlaps;
      const exclusivityConflict = overlapPeriod && geoOrService && (ownExcl !== "none" || oExcl !== "none");

      if (!overlapPeriod || !overlaps) continue;

      const severity: "high" | "medium" | "low" = exclusivityConflict
        ? "high"
        : (sharedCities.length > 0 || sharedPostalCodes.length > 0) && sharedServices.length > 0
          ? "medium"
          : "low";

      conflicts.push({
        agreementId: other.id, title: other.title, status: other.status,
        overlapPeriod, sharedServices, sharedCities, sharedPostalCodes,
        exclusivityConflict, severity,
      });
    }

    conflicts.sort((a, b) => (a.severity === "high" ? -1 : b.severity === "high" ? 1 : 0));
    return { conflicts };
  });