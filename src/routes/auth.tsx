import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BPEILogo } from "@/components/BPEILogo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion — BPEI" },
      { name: "description", content: "Accédez à votre espace BPEI." },
      { property: "og:title", content: "Connexion à votre espace BPEI" },
      { property: "og:description", content: "Connectez-vous à votre espace boutique, indépendant ou administration BPEI." },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),

  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app", replace: true });
  },
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(6, "6 caractères minimum").max(72),
});

const signUpSchema = signInSchema.extend({
  firstName: z.string().trim().min(1, "Requis").max(80),
  lastName: z.string().trim().min(1, "Requis").max(80),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);


  async function onSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Connecté");
    navigate({ to: "/app", replace: true });
  }

  async function onSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
      firstName: fd.get("firstName"),
      lastName: fd.get("lastName"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Compte créé. Vérifiez votre email si la confirmation est requise.");
    navigate({ to: "/app", replace: true });
  }

  return (
    <div className="flex min-h-screen">
      {/* Left brand pane */}
      <div className="hidden bpei-hero-bg text-navy-foreground md:flex md:w-1/2 md:flex-col md:justify-between md:p-12">
        <Link to="/">
          <BPEILogo variant="light" />
        </Link>
        <div className="max-w-md">
          <h2 className="text-3xl font-bold leading-tight text-white">
            La plateforme professionnelle des experts informatiques.
          </h2>
          <p className="mt-4 text-white/70">
            Accédez à votre espace personnel, professionnel ou administrateur.
          </p>
        </div>
        <div className="text-xs text-white/40">© BPEI — Version bêta</div>
      </div>

      {/* Right form pane */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 md:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <Link to="/"><BPEILogo variant="dark" /></Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Accéder à BPEI</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connectez-vous ou créez un compte gratuitement.
          </p>

          <Tabs defaultValue="signin" className="mt-8">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Créer un compte</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={onSignIn} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input id="password" name="password" type="password" required autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full bg-electric text-electric-foreground hover:bg-electric/90" disabled={loading}>
                  {loading ? "Connexion…" : "Se connecter"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={onSignUp} className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input id="firstName" name="firstName" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom</Label>
                    <Input id="lastName" name="lastName" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-up">Email</Label>
                  <Input id="email-up" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-up">Mot de passe</Label>
                  <Input id="password-up" name="password" type="password" required minLength={6} autoComplete="new-password" />
                </div>
                <Button type="submit" className="w-full bg-electric text-electric-foreground hover:bg-electric/90" disabled={loading}>
                  {loading ? "Création…" : "Créer mon compte"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Retour à l'accueil</Link>
          </p>
        </div>
      </div>
    </div>
  );
}