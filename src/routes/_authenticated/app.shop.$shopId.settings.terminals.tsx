import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { PageContainer, PageHeader } from "@/components/ui-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Star, Trash2, Loader2, MapPin, Cpu } from "lucide-react";
import { toast } from "sonner";
import { listTerminalLocations, createTerminalLocation, deleteTerminalLocation } from "@/lib/terminal/locations.functions";
import { listTerminalReaders, registerTerminalReader, createSimulatedReader, setDefaultReader, deleteTerminalReader } from "@/lib/terminal/readers.functions";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/settings/terminals")({
  head: () => ({ meta: [{ title: "Lecteurs TPE — BPEI" }] }),
  component: TerminalsPage,
});

function TerminalsPage() {
  const ctx = useShop();
  const shopId = ctx.shopId;
  const qc = useQueryClient();
  const locFn = useServerFn(listTerminalLocations);
  const readerFn = useServerFn(listTerminalReaders);
  const locations = useQuery({ queryKey: ["terminal-locations", shopId], queryFn: () => locFn({ data: { shopId } }) });
  const readers = useQuery({ queryKey: ["terminal-readers", shopId], queryFn: () => readerFn({ data: { shopId } }) });

  const [locDialog, setLocDialog] = useState(false);
  const [readerDialog, setReaderDialog] = useState<null | { locationId: string }>(null);

  const createLoc = useServerFn(createTerminalLocation);
  const delLoc = useServerFn(deleteTerminalLocation);
  const regReader = useServerFn(registerTerminalReader);
  const simReader = useServerFn(createSimulatedReader);
  const setDef = useServerFn(setDefaultReader);
  const delReader = useServerFn(deleteTerminalReader);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["terminal-locations", shopId] });
    qc.invalidateQueries({ queryKey: ["terminal-readers", shopId] });
  };

  const createLocM = useMutation({
    mutationFn: (v: any) => createLoc({ data: { shopId, ...v } }),
    onSuccess: () => { toast.success("Emplacement créé"); setLocDialog(false); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });
  const regReaderM = useMutation({
    mutationFn: (v: any) => regReader({ data: { shopId, ...v } }),
    onSuccess: () => { toast.success("Lecteur enregistré"); setReaderDialog(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });
  const simM = useMutation({
    mutationFn: (locationId: string) => simReader({ data: { shopId, locationId, label: "Lecteur simulé", setDefault: true } }),
    onSuccess: () => { toast.success("Lecteur simulé créé"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  return (
    <PageContainer>
      <PageHeader title="Lecteurs TPE" description="Enregistrez vos terminaux Stripe pour encaisser au comptoir." />
      <Alert>
        <AlertTitle>Mode TEST Stripe</AlertTitle>
        <AlertDescription>
          Ce module est actuellement en test. Aucun paiement réel n'est encaissé tant que le mode LIVE
          n'a pas été validé par la plateforme et par votre expert-comptable.
        </AlertDescription>
      </Alert>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" />Emplacements</CardTitle>
          <Button size="sm" onClick={() => setLocDialog(true)}>Ajouter un emplacement</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {locations.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
           (locations.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Aucun emplacement. Créez-en un avant d'enregistrer un lecteur.</p> :
           (locations.data ?? []).map((l: any) => (
            <div key={l.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{l.name} {l.livemode ? <Badge>LIVE</Badge> : <Badge variant="secondary">TEST</Badge>}</div>
                <div className="text-xs text-muted-foreground">{l.stripe_location_id}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setReaderDialog({ locationId: l.id })}>Ajouter un lecteur</Button>
                <Button size="sm" variant="outline" onClick={() => simM.mutate(l.id)}>Lecteur simulé (test)</Button>
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!confirm("Supprimer cet emplacement ?")) return;
                  try { await delLoc({ data: { shopId, locationId: l.id } }); toast.success("Supprimé"); invalidate(); }
                  catch (e: any) { toast.error(e?.message ?? "Erreur"); }
                }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="h-4 w-4" />Lecteurs</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {readers.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
           (readers.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Aucun lecteur enregistré.</p> :
           (readers.data ?? []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {r.label}
                  {r.is_default && <Badge variant="default">Défaut</Badge>}
                  {r.is_simulated && <Badge variant="outline">Simulé</Badge>}
                  {r.livemode ? <Badge>LIVE</Badge> : <Badge variant="secondary">TEST</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{r.stripe_reader_id} · {r.device_type ?? "—"} · {r.status ?? "—"}</div>
              </div>
              <div className="flex gap-2">
                {!r.is_default && (
                  <Button size="sm" variant="outline" onClick={async () => {
                    try { await setDef({ data: { shopId, readerId: r.id } }); toast.success("Défaut mis à jour"); invalidate(); }
                    catch (e: any) { toast.error(e?.message ?? "Erreur"); }
                  }}><Star className="h-4 w-4 mr-1" />Défaut</Button>
                )}
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!confirm("Retirer ce lecteur ?")) return;
                  try { await delReader({ data: { shopId, readerId: r.id } }); toast.success("Supprimé"); invalidate(); }
                  catch (e: any) { toast.error(e?.message ?? "Erreur"); }
                }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={locDialog} onOpenChange={setLocDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvel emplacement</DialogTitle></DialogHeader>
          <LocationForm onSubmit={(v) => createLocM.mutate(v)} loading={createLocM.isPending} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!readerDialog} onOpenChange={(o) => !o && setReaderDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enregistrer un lecteur</DialogTitle></DialogHeader>
          <ReaderForm onSubmit={(v) => regReaderM.mutate({ ...v, locationId: readerDialog!.locationId })} loading={regReaderM.isPending} />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function LocationForm({ onSubmit, loading }: { onSubmit: (v: any) => void; loading: boolean }) {
  const [v, setV] = useState({ name: "", line1: "", city: "", postal_code: "", country: "FR", setDefault: true });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }} className="space-y-3">
      <div><Label>Nom</Label><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required /></div>
      <div><Label>Adresse</Label><Input value={v.line1} onChange={(e) => setV({ ...v, line1: e.target.value })} required /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Code postal</Label><Input value={v.postal_code} onChange={(e) => setV({ ...v, postal_code: e.target.value })} required /></div>
        <div><Label>Ville</Label><Input value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} required /></div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Créer</Button>
      </DialogFooter>
    </form>
  );
}

function ReaderForm({ onSubmit, loading }: { onSubmit: (v: any) => void; loading: boolean }) {
  const [v, setV] = useState({ label: "", registrationCode: "", setDefault: true });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(v); }} className="space-y-3">
      <div><Label>Label</Label><Input value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} required /></div>
      <div>
        <Label>Code d'enregistrement</Label>
        <Input value={v.registrationCode} onChange={(e) => setV({ ...v, registrationCode: e.target.value })} required
          placeholder="Ex : mots-affichés-terminal ou simulated-wpe" />
        <p className="text-xs text-muted-foreground mt-1">
          Affiché sur le terminal (Réglages → Générer un code d'enregistrement).
        </p>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer</Button>
      </DialogFooter>
    </form>
  );
}