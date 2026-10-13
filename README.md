# DevizIA

Devis lissage par IA pour les lisseuses. La cliente choisit son lissage, prend 3 photos guidées de ses cheveux, l'IA en analyse la longueur, le volume, les repousses et les pointes, la cliente complète 4 précisions, puis elle reçoit un prix calculé avec la grille tarifaire de sa lisseuse et réserve avec acompte sur Planity.

- **Parcours cliente** : `/{lien-du-salon}` (exemple : `/atelier-soie`)
- **Espace lisseuse** : `/pro` (demandes avec photos, grille tarifaire, questionnaire, lien en bio, réglages)
- **Page d'accueil** : `/`

## Stack

| Rôle | Outil |
| --- | --- |
| Application (front + API) | Next.js 16 (App Router), TypeScript, Tailwind CSS 4 |
| Base de données, comptes, photos | Supabase (Postgres + Auth par lien e-mail + Storage privé) |
| Analyse des photos | API Anthropic (Claude), sortie JSON structurée |
| Hébergement | Vercel |

## Mode démo (sans configuration)

Tant que Supabase n'est pas configuré, l'appli tourne en **mode démo** : le parcours cliente fonctionne en entier sur `/atelier-soie`, rien n'est enregistré, et un bandeau l'indique sur le devis. Sans clé Anthropic, l'analyse des photos est simulée ; avec une clé, elle est réelle.

C'est la façon la plus rapide de montrer l'outil à un salon : déploie sur Vercel sans variable (ou avec seulement `ANTHROPIC_API_KEY`) et ouvre `/atelier-soie` sur ton téléphone.

## Lancer en local

```bash
npm install
cp .env.example .env.local   # puis remplis les valeurs (ou laisse vide pour le mode démo)
npm run dev                  # http://localhost:3000
npm test                     # tests du moteur de prix
```

## Mise en production

### 1. Supabase

1. Crée un projet sur [supabase.com](https://supabase.com) en choisissant une région **européenne** (par exemple Paris, `eu-west-3`) pour le RGPD.
2. Dans **SQL Editor**, exécute `supabase/migrations/0001_init.sql`, puis `supabase/seed.sql` (salon de démonstration `atelier-soie`, à supprimer quand tu n'en as plus besoin).
3. Dans **Authentication > URL Configuration**, mets ton domaine dans *Site URL* (par exemple `https://devizia.vercel.app`) et ajoute `https://devizia.vercel.app/pro` dans *Redirect URLs*.
4. Récupère dans **Project Settings > API** l'URL du projet, la clé `anon` et la clé `service_role`.
5. Nettoyage RGPD automatique : dans **Database > Extensions**, active `pg_cron`, puis exécute :
   ```sql
   select cron.schedule('devizia-purge', '0 3 * * *', $$select public.purge_old_data()$$);
   ```
   Les brouillons jamais envoyés sont supprimés après 24 h, les photos après 90 jours.

### 2. Anthropic

Crée une clé API sur [console.anthropic.com](https://console.anthropic.com). Le modèle utilisé se règle avec `ANTHROPIC_MODEL` (par défaut `claude-sonnet-5-5`).

### 3. Vercel

1. Importe le dépôt GitHub sur [vercel.com](https://vercel.com).
2. Ajoute les variables de `.env.example` dans **Settings > Environment Variables**.
3. Déploie. La route d'analyse est configurée pour 60 s maximum (`maxDuration`).

### 4. Côté lisseuse

1. Elle se connecte sur `/pro` avec son e-mail (lien de connexion, sans mot de passe) et crée son espace (nom + lien).
2. Elle ajuste sa grille tarifaire et ses lissages.
3. Sur **Planity**, elle crée une prestation réservable par lissage et par longueur (par exemple « Tanin · milieu du dos »), avec le prépaiement activé : c'est cette prestation que le devis indique à la cliente.
4. Elle colle son lien dans sa bio Instagram.

## Comment le prix est calculé

`src/lib/pricing.ts` (testé dans `pricing.test.ts`) :

- **base** = grille[lissage][longueur] ;
- **suppléments** : volume moyen ou dense, cheveux bouclés (type 3) ou crépus (type 4), soin après décoloration ;
- **fourchette** = [prix, prix + largeur réglable] ;
- si la cliente déclare du **henné** et que le réglage est actif, aucun prix n'est donné : elle est invitée à un diagnostic en salon.

Le prix est toujours recalculé **côté serveur** à partir de l'analyse enregistrée dans le brouillon : la cliente ne peut pas le modifier. Elle peut corriger la longueur et le volume détectés ; la lisseuse voit alors la valeur de l'IA et la correction.

## Sécurité et données

- Les clientes n'écrivent jamais directement en base : tout passe par `/api/analyze` et `/api/requests` (clé service, côté serveur uniquement).
- Règles RLS : une lisseuse ne voit et ne modifie que son salon et ses demandes ; elle ne peut changer que le statut et l'ajustement de prix d'une demande.
- Photos dans un bucket **privé**, rangées par salon, lues via des liens signés valables 1 h.
- Consentement explicite de la cliente avant l'envoi de ses coordonnées et de ses photos.
- Polices auto-hébergées : aucun appel à Google depuis le navigateur des clientes.

## Structure

```
src/
  app/
    page.tsx                 page d'accueil (lisseuses)
    [slug]/page.tsx          parcours cliente d'un salon
    pro/page.tsx             espace lisseuse
    api/analyze/route.ts     photos → stockage → analyse IA → brouillon
    api/requests/route.ts    brouillon + réponses → devis → demande
  components/
    quote/QuoteFlow.tsx      parcours cliente (5 étapes)
    pro/*                    onglets de l'espace lisseuse
    ui.tsx                   boutons, pastilles, silhouette, logo
  lib/
    domain.ts                vocabulaire métier (longueurs, types 1 à 4…)
    pricing.ts               moteur de prix
    analysis.ts              appel à l'IA + schéma de réponse
    demo.ts                  mode démo
    supabase/                clients serveur et navigateur
supabase/
  migrations/0001_init.sql   tables, RLS, stockage, purge RGPD
  seed.sql                   salon de démonstration
```

## Prochaines étapes

- E-mails automatiques (nouvelle demande pour la lisseuse, devis pour la cliente) via un service comme Resend ; aujourd'hui la lisseuse envoie le devis en un clic par e-mail ou SMS depuis son téléphone.
- Limitation du nombre d'analyses par appareil (anti-abus et maîtrise du coût de l'IA).
- Mesurer la fiabilité de l'IA sur de vraies photos (comparer avec l'avis des lisseuses) avant de mettre en avant les taux affichés.
- Mentions légales, politique de confidentialité, CGU clientes et CGV lisseuses.
- Abonnement des lisseuses (Stripe).
