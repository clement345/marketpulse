# MarketPulse (Personal Financial Intelligence Terminal)

A Bloomberg-style personal terminal: cross-asset quotes, aggregated and de-duplicated news,
macro calendar, watchlists, sourced AI analysis, alerts, a Morning Brief and a Market Wrap.
Built with **Next.js 15, TypeScript, Prisma / PostgreSQL** and a separate ingestion worker.

- Only free, verified data sources (Yahoo chart API, Binance, US Treasury, ECB SDMX, BLS,
  Nasdaq earnings, Forex Factory, RSS feeds from Bloomberg / FT / CNBC / Fed / ECB…).
- **No fabricated data**: every quote carries its source timestamp and a freshness status;
  missing values are shown as unavailable.
- AI summaries and analysis with sources, rate-limited.
- Unit tests with Vitest.

```bash
cp .env.example .env && npm install && npx prisma db push
npm run build && npm run start:all     # web on :3000 + worker
```

---

*Documentation détaillée (français) :*

# MarketPulse

Terminal personnel d'intelligence financière : cotations cross-asset, news agrégées et dédupliquées, calendrier macro, watchlists, analyse IA sourcée, alertes, Morning Brief et Market Wrap.

Priorité absolue : **aucune donnée fabriquée**. Chaque cotation porte son horodatage source et un statut de fraîcheur (Temps réel / Différé / Donnée ancienne / Dernière clôture / Quotidien). Toute valeur absente est affichée « n/d » ou « indisponible ».

## Lancer

Prérequis : Node ≥ 20, PostgreSQL, et en option la CLI `claude` connectée à un abonnement Claude pour l'IA.

```bash
cp .env.example .env              # puis renseigner DATABASE_URL (et le reste si besoin)
createdb marketpulse              # ou CREATE DATABASE marketpulse;
npm install
npx prisma db push                # crée le schéma
npm run build
npm run start:all                 # serveur web (port 3000) + worker d'ingestion
```

Ouvrir http://localhost:3000. En développement, utiliser `npm run dev:all`.

| Commande | Rôle |
|---|---|
| `npm run worker` | ingestion continue (cotations, news, calendrier, alertes, IA, rapports) |
| `npm run worker:once` | un cycle d'ingestion complet, puis arrêt |
| `npm test` | tests unitaires (vitest) |
| `npm run typecheck` | vérification TypeScript |

Le worker doit tourner pour que les données se mettent à jour. Sans lui, l'interface affiche les dernières données en base, avec leur âge réel.

## Architecture

```
navigateur ──SSE /api/stream──┐
   │  SWR (fetch /api/*)      │
   ▼                          │
Next.js 15 (App Router, API routes) ── Prisma ── PostgreSQL ◄── worker (tsx)
                                                                 │
               ┌───────────────┬──────────────┬──────────────┬───┴──────────┐
         quotesService     news/ingest   calendar/ingest   alerts/engine   reports + ai
         (providers/*)     (RSS/Atom)    (FF, Fed, BCE,    (règles, anti-  (claude -p)
                                          Nasdaq, BLS)      spam, Telegram/email)
```

- **Fournisseurs interchangeables** : chaque source de cotations implémente `QuoteProvider` (`src/lib/providers/types.ts`). Le routage principal → secours est défini dans `src/lib/quotesService.ts` (Binance → Yahoo pour la crypto).
- **Instruments** : `src/lib/instruments.ts`. **Horaires et jours fériés** : `src/lib/marketHours.ts`. **Fraîcheur** : `src/lib/freshness.ts`.
- **News** : flux dans `src/lib/news/feeds.ts`, classification par règles (catégorie, pays, actifs, importance 1–5) dans `classify.ts`, déduplication URL et regroupement des titres proches par similarité de Jaccard dans `dedup.ts`.
- **IA** : `src/lib/ai/`. Fournisseur par défaut : `ClaudeCliProvider`, qui lance `claude -p` sans outils, sans MCP et avec un prompt système dédié. Le contexte transmis contient uniquement des données collectées, chacune avec un identifiant citable ([N1], [E2], [Q]). Les liens des sources sont rattachés par le code, jamais générés par le modèle. Pour brancher une API (Anthropic ou OpenAI), il suffit d'implémenter `AiProvider` dans `claude.ts`.
- **Temps réel** : le worker écrit en base. `/api/stream` (SSE) pousse au navigateur les changements (cotations, news, notifications), et l'interface recharge les données concernées. Redis n'est pas utilisé, car inutile pour un utilisateur unique : le cache est en mémoire pour l'historique et les corrélations.
- **Auth** : si `APP_PASSWORD` est défini, toute l'app est protégée par un cookie HMAC (middleware). Sinon, l'accès est libre, à réserver à un usage local.

## Sources de données (vérifiées le 14/11/2026)

| Donnée | Source | Coût / licence | Latence |
|---|---|---|---|
| 9 indices, FX, or, WTI, Brent, VIX, actions | Yahoo Finance (`query2…/v8/finance/chart`) | gratuit, sans clé, **non officiel**, usage personnel | différé (~15–20 min selon la place) |
| BTC, ETH | Binance API publique (secours : Yahoo) | gratuit | temps réel |
| US 2Y / 10Y | U.S. Treasury, Daily Par Yield Curve | officiel, domaine public | quotidien |
| Zone euro 2Y / 10Y | BCE Data Portal, courbe AAA | officiel, gratuit | quotidien (J+1) |
| News | RSS Bloomberg, FT, CNBC, MarketWatch, Investing.com, Yahoo Finance, Fed, BCE | flux publics : titre + résumé + lien uniquement | minutes |
| Dépôts 8-K | SEC EDGAR (si `SEC_USER_AGENT`) | gratuit, User-Agent avec email obligatoire | minutes |
| Calendrier macro | Forex Factory, export JSON | gratuit, semaine courante uniquement |: |
| Valeurs réelles US | BLS Public API v1 (CPI, Core CPI, NFP, chômage, salaires horaires, PPI) | officiel, 25 requêtes/jour sans clé | publication + quelques min |
| Réunions Fed / BCE | pages calendrier officielles | officiel |: |
| Résultats d'entreprises | api.nasdaq.com | gratuit, non documenté |: |
| Corrélations | Yahoo, 6 mois de clôtures quotidiennes | idem Yahoo |: |

### Ce qui n'est PAS disponible gratuitement (et n'est donc pas simulé)

- **Reuters** : plus de flux RSS public ; l'accès passe par une API LSEG payante.
- **Valeurs réelles macro hors US** (zone euro, UK, Japon…) et **consensus au-delà de la semaine en cours** : Trading Economics, Bloomberg et Refinitiv sont payants. Ces cases affichent « n/d ».
- **Cotations temps réel des indices** : il faut un flux payant (Polygon, Twelve Data payant, IEX Cloud…). Il suffit d'ajouter un `QuoteProvider`.
- **Bund 10 ans coté en continu** : on affiche à la place l'indicateur officiel BCE (courbe AAA), publié une fois par jour.
- **Articles complets** : seuls le titre et le résumé publiés par le flux sont stockés ; les paywalls ne sont pas contournés.

## Fonctionnalités

**Phase 1 (MVP)** : dashboard (Market Overview avec cours, variation en points et en %, sparkline, heure de cotation et état du marché ; Cross-Asset Monitor avec filtres), fil de news (recherche, filtres actif/pays/catégorie/source/importance, favoris, déduplication avec « +N sources », onglet Breaking), calendrier jour/semaine/mois en heure de Paris (compte à rebours, surprises, historique des valeurs collectées), watchlists multiples (recherche de symboles Yahoo, news et résultats associés), page actif (graphique Lightweight Charts 1J→5A, news liées, alerte de prix en un clic), rafraîchissement automatique en SSE, interface responsive.

**Phase 2 (IA)** : analyse structurée par news (résumé, explication, enjeux, actifs, mécanismes, scénarios haussier/neutre/baissier, incertitude, faits ou hypothèses, sources), automatique pour les news d'importance ≥ 4 (plafonnée par `AI_MAX_AUTO_ANALYSES_PER_HOUR`) ou à la demande ; chat analyste avec citations cliquables ; Morning Brief à 07:30 et Market Wrap à 22:30 (Paris), générés par le worker avec rattrapage s'il démarre en retard, et régénérables manuellement. Si l'IA échoue, le rapport factuel est produit quand même.

**Phase 3** : moteur d'alertes (seuil de prix, variation d'indice, pic de VIX, publication Fed/BCE, macro imminente, résultats de la watchlist, news importante sur un actif suivi), avec priorité, anti-spam (cooldown, déduplication, heures calmes, plafond horaire) et canaux in-app, navigateur, Telegram et email ; heatmap ; matrice de corrélations ; panneaux redimensionnables et masquables, disposition mémorisée.

## Configuration optionnelle

- **Telegram** : créer un bot via @BotFather, puis renseigner `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID`.
- **Email** : renseigner `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et `ALERT_EMAIL_TO`.
- **SEC EDGAR** : `SEC_USER_AGENT="MarketPulse votre@email"` active les dépôts 8-K pour les actions US des watchlists.
- **IA** : `AI_PROVIDER=none` désactive toute IA. `CLAUDE_MODEL` vaut `sonnet` par défaut. Avec le fournisseur `claude-cli`, l'usage est décompté du quota de l'abonnement Claude, sans facturation à l'appel.

## Limites connues

- Yahoo et Nasdaq sont des endpoints publics non documentés, susceptibles de changer ou d'être limités (des 429 ont été observés sur `query1`). Les erreurs sont visibles sur la page **Sources**.
- La classification des news repose sur des mots-clés : des faux positifs sont possibles, par exemple un actif rattaché à tort.
- Les fériés JPX et HKEX sont saisis pour 2026 uniquement ; les listes de `marketHours.ts` sont à mettre à jour chaque année.
- Les corrélations sont asynchrones, car les places ne clôturent pas à la même heure.
- La surprise sur les valeurs BLS est calculée à partir des niveaux d'indice publiés : l'arrondi peut exceptionnellement différer de 0,1 point du communiqué officiel.
