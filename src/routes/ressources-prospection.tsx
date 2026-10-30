import {createFileRoute,Link} from "@tanstack/react-router";
import {PublicShell} from "@/components/public/PublicShell";
export const Route=createFileRoute("/ressources-prospection")({
 component:ProspectingResources,
 head:()=>({meta:[
  {title:"Guide de prospection moderne pour informaticiens indépendants — BPEI"},
  {name:"description",content:"Conseils concrets et responsables pour développer une clientèle informatique locale B2B et B2C en 2026, sans boutique ni prospection de masse."}
 ]})
});
const companyEmail=`Objet : Support informatique local à [ville] — [votre entreprise]
Bonjour [prénom],
Je suis [prénom nom], technicien informatique indépendant, partenaire du réseau BPEI, basé à [ville].
Je peux aider les petites équipes sur [type de besoin informatique pertinent pour leur activité : dépannage, Wi-Fi, sauvegarde ou maintenance].
Si ce sujet est utile, je peux vous expliquer mon fonctionnement et vous transmettre un devis avant toute intervention.
Si vous ne souhaitez plus de messages de ma part, une simple réponse suffit et je n'insisterai pas.
Bonne journée,
[Nom, coordonnées professionnelles et SIRET lorsque disponible]`;
const followUp=`Objet : Suite à mon message concernant votre support informatique
Bonjour [prénom],
Je me permets une seule relance concernant mon précédent message.
Si vous cherchez ponctuellement un technicien indépendant à [ville] pour [besoin réellement pertinent], je peux vous présenter les prestations adaptées sans engagement.
Sinon, je ne vous recontacterai pas à ce sujet.
Bonne journée,
[Nom et coordonnées professionnelles]`;
const referral=`Bonjour [prénom],
Je suis technicien informatique indépendant à [ville], partenaire de BPEI.
Je cherche à créer quelques partenariats locaux avec des professionnels aux services complémentaires : création de sites, téléphonie, bureaux partagés, maintenance ou conseil.
Quand un client recherche un prestataire hors de mon domaine, je préfère l'orienter vers quelqu'un de fiable, avec son accord. Seriez-vous disponible pour un échange sur nos prestations respectives ?
[Nom et moyen de contact]`;
function Script({title,content}:{title:string;content:string}){
 return <div className="rounded-lg border bg-muted/20 p-4"><h3 className="font-semibold">{title}</h3>
  <pre className="mt-3 whitespace-pre-wrap font-sans text-sm">{content}</pre>
 </div>;
}
function ProspectingResources(){
 return <PublicShell><main className="mx-auto max-w-4xl space-y-7 px-4 py-12 md:px-6">
  <div><p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">BPEI · Ressources partenaires</p>
   <h1 className="mt-2 text-3xl font-bold">Trouver ses premiers clients sans boutique</h1>
   <p className="mt-3 text-muted-foreground">Un guide pratique pour les indépendants débutants et expérimentés. Vous choisissez librement les méthodes adaptées à votre ville, sans objectifs de prospection imposés.</p>
  </div>
  <section className="space-y-3">
   <h2 className="text-xl font-semibold">1. Préparer une offre compréhensible</h2>
   <p>Choisissez deux ou trois prestations que vous maîtrisez réellement : ordinateur qui ne démarre plus, sauvegarde, réseau Wi-Fi, installation et sécurité de base, assistance à distance. Définissez la zone, les créneaux que vous acceptez, les conditions et un mode de devis clair. Ne prétendez pas posséder des compétences qui n'ont pas été évaluées.</p>
   <p>Présentez-vous comme <strong>« Technicien informatique indépendant — Partenaire du réseau BPEI »</strong>, sans laisser penser que vous êtes salarié de l'enseigne.</p>
  </section>
  <section className="space-y-3">
   <h2 className="text-xl font-semibold">2. Être trouvé par les clients de sa ville</h2>
   <ul className="list-disc space-y-2 pl-6">
    <li>Développez une page locale avec votre zone, vos prestations réelles, des exemples anonymisés et un moyen simple de demander un devis.</li>
    <li>Si vous intervenez effectivement chez les clients et respectez les critères Google, une fiche d'établissement « zone desservie » peut être pertinente sans boutique : utilisez votre véritable zone et masquez l'adresse de domicile si elle n'accueille pas de clients.</li>
    <li>Demandez un retour authentique après une prestation achevée. N'achetez pas d'avis et ne promettez pas de note.</li>
    <li>Développez des relations avec des réparateurs, espaces de coworking, agences web ou téléphonie de proximité. Chaque apport doit respecter les accords des clients et les règles BPEI.</li>
   </ul>
   <p className="text-sm">Référence : <a className="underline" target="_blank" rel="noopener noreferrer" href="https://support.google.com/business/answer/3038177">règles officielles Google pour les établissements à zone de service</a>. Une plateforme de génération de prospects ou une simple marque virtuelle ne peut pas créer artificiellement des établissements locaux.</p>
  </section>
  <section className="space-y-3">
   <h2 className="text-xl font-semibold">3. Prospecter les entreprises de façon ciblée</h2>
   <p>Commencez par un secteur où vous êtes crédible : commerces, cabinets, artisans, TPE, associations. Recherchez un besoin informatique plausible et une personne pertinente, sans prétendre avoir détecté une panne chez elle. Une communication professionnelle doit rester liée à sa fonction, identifier clairement l'émetteur et offrir une opposition gratuite et simple.</p>
   <Script title="Message B2B à personnaliser" content={companyEmail}/>
   <Script title="Une relance facultative, puis arrêt" content={followUp}/>
   <Script title="Premier contact pour un partenariat local" content={referral}/>
  </section>
  <section className="space-y-3">
   <h2 className="text-xl font-semibold">4. Respecter les consommateurs et la confidentialité</h2>
   <p>Ne faites pas de démarchage commercial non sollicité par e-mail, SMS ou téléphone auprès des particuliers sans consentement préalable applicable. Ne récupérez pas des listes de coordonnées personnelles dans des annuaires pour les exploiter. Les campagnes B2B nécessitent aussi une information, une pertinence professionnelle et un mécanisme d'opposition.</p>
   <p>Le consentement à des CGU n'est pas automatiquement un consentement à la publicité. Conservez uniquement la preuve nécessaire de l'origine du prospect et respectez les demandes de retrait.</p>
   <p className="text-sm">Sources officielles : <a className="underline" target="_blank" rel="noopener noreferrer" href="https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique">CNIL — prospection électronique</a> et <a className="underline" target="_blank" rel="noopener noreferrer" href="https://www.cnil.fr/fr/prospection-commerciale-par-telephone-hors-automate-dappel-quelles-sont-les-regles">CNIL — prospection téléphonique (2026)</a>.</p>
  </section>
  <section className="space-y-3">
   <h2 className="text-xl font-semibold">5. Suivre ses opportunités sans harceler</h2>
   <p>Dans le carnet de prospects de votre espace BPEI, enregistrez l'origine du contact et la base légale, notez son besoin et faites progresser son statut : nouveau, contacté, qualifié, devis ou gagné/perdu. Supprimez ou cessez le suivi commercial lorsqu'il n'est plus justifié. Les prises de contact doivent rester volontaires et pertinentes.</p>
   <Link className="inline-block underline" to="/espace-independant">Accéder à mon espace et au carnet de prospects</Link>
  </section>
  <section className="space-y-3">
   <h2 className="text-xl font-semibold">6. Respecter les décisions du partenaire indépendant</h2>
   <p>Vous n'êtes pas tenu de prospecter, d'accepter une mission ou de travailler selon un horaire fixé par BPEI. Avant toute intervention, le réseau doit vous communiquer le prix proposé, votre part HT, la part BPEI, les conditions de déplacement et le cadre contractuel ; vous pouvez refuser. Le barème dépend du niveau et de l'origine du client, selon votre convention effectivement conclue.</p>
  </section>
 </main></PublicShell>;
}
