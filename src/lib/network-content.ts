// Textes publics du réseau national BPEI (accueil, recrutement, FAQ, kit de partage).
// Règles éditoriales : pas de couverture nationale effective annoncée, pas de promesse
// de revenu ni de volume de missions, collaboration freelance non salariée,
// aucun tarif ni commission fixés ici.

export const SITE_URL = "https://bpei.fr";

export type FaqItem = { q: string; a: string };

export const FAQ_CLIENTS: FaqItem[] = [
  {
    q: "BPEI intervient-il partout en France ?",
    a: "Le réseau est en cours de constitution. Vous pouvez envoyer une demande depuis toute la France, mais une intervention dépend de la présence d'un partenaire vérifié près de chez vous. Après examen de votre demande, nous vous indiquons clairement si une prise en charge est possible.",
  },
  {
    q: "Combien coûte une demande ?",
    a: "Envoyer une demande est gratuit et sans engagement. Aucun paiement n'est demandé sur ce site. Si un partenaire peut intervenir, le prix de l'intervention vous est présenté avant toute intervention, et vous restez libre de refuser.",
  },
  {
    q: "Qui intervient chez moi ?",
    a: "Un technicien informatique indépendant (entrepreneur individuel ou société), partenaire du réseau BPEI. Les partenaires sont vérifiés par l'équipe BPEI avant de pouvoir recevoir des demandes.",
  },
  {
    q: "Sous quel délai serai-je recontacté ?",
    a: "Nous traitons les demandes au fil de l'eau. Le délai dépend de votre zone et des disponibilités des partenaires : nous ne pouvons pas garantir de délai d'intervention.",
  },
  {
    q: "Que deviennent mes informations ?",
    a: "Elles servent uniquement à traiter votre demande et à vous recontacter. Elles ne sont ni vendues ni utilisées à des fins publicitaires. Vous pouvez demander leur suppression à tout moment.",
  },
];

export const FAQ_PARTNERS: FaqItem[] = [
  {
    q: "Est-ce une offre d'emploi ?",
    a: "Non. BPEI ne recrute pas de salariés pour ce réseau. Il s'agit d'une collaboration entre professionnels indépendants : vous restez votre propre patron, libre d'accepter ou de refuser chaque demande, et libre de travailler avec d'autres clients ou plateformes.",
  },
  {
    q: "Combien vais-je gagner ?",
    a: "BPEI ne promet ni revenu, ni volume de missions. Le nombre de demandes dépend de votre zone, de vos compétences et du développement du réseau. Les conditions financières de la collaboration (tarifs, éventuelle commission) vous seront présentées par écrit, et devront être acceptées, avant toute première mission.",
  },
  {
    q: "Je ne suis pas encore immatriculé(e), puis-je candidater ?",
    a: "Oui. Indiquez « en projet de création » dans le formulaire. Vous pourrez échanger avec l'équipe BPEI, mais l'immatriculation (micro-entreprise, entreprise individuelle ou société) sera obligatoire avant toute mission. Les conseillers France Travail, l'URSSAF ou votre CCI/CMA peuvent vous accompagner dans cette démarche.",
  },
  {
    q: "Faut-il payer pour candidater ?",
    a: "Non. La candidature est gratuite et sans engagement. Aucun paiement n'est demandé lors de la candidature.",
  },
  {
    q: "Quelles vérifications sont faites ?",
    a: "Avant tout accès aux demandes clients, l'équipe BPEI vérifie notamment votre identité, votre immatriculation (SIRET actif) et votre assurance responsabilité civile professionnelle, puis échange avec vous. Une candidature n'ouvre aucun accès automatique.",
  },
  {
    q: "Quelles compétences sont recherchées ?",
    a: "Dépannage PC/Mac, smartphones, réseau et Wi-Fi, sécurité, récupération de données, accompagnement des débutants, informatique de TPE/PME… Les profils généralistes comme spécialisés sont les bienvenus. Le sérieux et la qualité de la relation client comptent autant que la technique.",
  },
];

export const HOW_IT_WORKS_CLIENT = [
  { title: "Vous décrivez votre besoin", desc: "Formulaire simple : votre appareil, le problème, votre ville. Gratuit et sans engagement." },
  { title: "Nous cherchons un partenaire", desc: "L'équipe BPEI regarde si un technicien indépendant vérifié peut intervenir dans votre zone." },
  { title: "Nous revenons vers vous", desc: "Nous vous indiquons honnêtement si une prise en charge est possible, et par qui." },
  { title: "Vous décidez", desc: "Le prix vous est présenté avant toute intervention. Vous restez libre d'accepter ou non." },
];

export const HOW_IT_WORKS_PARTNER = [
  { title: "Vous candidatez", desc: "5 minutes : coordonnées, compétences, zone d'intervention, situation (immatriculé ou en projet)." },
  { title: "Nous échangeons", desc: "Un membre de l'équipe BPEI vous contacte pour mieux connaître votre profil." },
  { title: "Vérification", desc: "Identité, immatriculation, assurance RC Pro. Aucun accès aux missions avant cette étape." },
  { title: "Demandes de votre zone", desc: "Une fois vérifié(e), vous pouvez recevoir des demandes, selon l'activité de votre secteur." },
];

export type ShareText = { id: string; title: string; audience: string; text: string };

const link = (path: string, campaign: string, source = "reseaux_sociaux") =>
  `${SITE_URL}${path}?utm_source=${source}&utm_medium=partage&utm_campaign=${campaign}`;

export const SHARE_TEXTS: ShareText[] = [
  {
    id: "lancement",
    title: "Annonce de lancement",
    audience: "Facebook, LinkedIn, Instagram",
    text: `🚀 BPEI se lance : un réseau national de techniciens informatiques indépendants.

Ordinateur lent, panne, Wi-Fi capricieux, données à récupérer ? Décrivez votre besoin en 2 minutes, nous cherchons un technicien indépendant vérifié près de chez vous.

Le réseau se construit région par région : nous vous disons honnêtement si un partenaire peut intervenir dans votre zone.

👉 ${link("/demander-une-intervention", "lancement")}`,
  },
  {
    id: "recrutement",
    title: "Appel à techniciens indépendants",
    audience: "Facebook, LinkedIn, groupes locaux",
    text: `💻 Vous êtes technicien(ne) informatique indépendant(e), ou vous avez le projet de le devenir ?

BPEI construit un réseau national de partenaires freelance pour répondre aux demandes de particuliers et de petites entreprises.

✔️ Collaboration indépendante, non salariée
✔️ Vous restez libre d'accepter ou refuser chaque demande
✔️ Candidature gratuite, vérification avant toute mission

Pas de promesse de revenu ni de volume : un réseau sérieux, qui se construit avec vous.

👉 ${link("/devenir-partenaire", "recrutement")}`,
  },
  {
    id: "court",
    title: "Version courte",
    audience: "X / Threads / stories",
    text: `BPEI : le réseau national des techniciens informatiques indépendants. Besoin d'aide ? ${link("/demander-une-intervention", "court")} · Technicien indépendant ? ${link("/devenir-partenaire", "court")}`,
  },
  {
    id: "france_travail",
    title: "Message à un conseiller France Travail",
    audience: "E-mail",
    text: `Objet : Présentation de BPEI — réseau de techniciens informatiques indépendants

Bonjour,

Je vous contacte pour vous présenter BPEI (bpei.fr), un réseau national en cours de constitution qui met en relation des particuliers et des petites entreprises avec des techniciens informatiques indépendants.

Nous recherchons des profils techniques souhaitant exercer en indépendant (micro-entreprise, entreprise individuelle ou société), y compris des personnes en projet de création d'activité. Il ne s'agit pas d'offres d'emploi salarié : la collaboration est freelance, sans garantie de volume de missions ni de revenu, et chaque partenaire est vérifié avant toute mission.

Les personnes intéressées peuvent candidater gratuitement ici :
${link("/devenir-partenaire", "france_travail", "france_travail")}

Je me tiens à votre disposition pour échanger sur la manière dont nous pourrions informer les demandeurs d'emploi concernés, dans le respect de vos règles de diffusion.

Bien cordialement,
[Prénom Nom]
BPEI — [téléphone]`,
  },
  {
    id: "partenaire_direct",
    title: "Message direct à un technicien",
    audience: "Message privé / e-mail",
    text: `Bonjour [Prénom],

Je lance BPEI, un réseau national de techniciens informatiques indépendants. L'idée : centraliser les demandes de particuliers et de TPE, et les proposer à des partenaires vérifiés dans leur zone.

C'est une collaboration freelance (tu restes indépendant et libre d'accepter ou non chaque demande). Je ne peux pas promettre de volume pour l'instant : le réseau démarre, et je cherche des professionnels sérieux pour le construire.

Si ça t'intéresse, la candidature prend 5 minutes : ${link("/devenir-partenaire", "message_direct", "contact_direct")}

À bientôt,
[Prénom]`,
  },
  {
    id: "bio",
    title: "Bio de profil",
    audience: "Instagram, Facebook, LinkedIn",
    text: `Réseau national de techniciens informatiques indépendants 💻 Dépannage, réseau, sécurité, données. Demande gratuite · Partenaires vérifiés · ${SITE_URL}`,
  },
];