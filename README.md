# Landing page — Lockd

Site statique (HTML/CSS/JS pur, aucun build) pour la page d'atterrissage de
**Lockd**, basé sur le pitch, le modèle économique et le catalogue d'objectifs
du dépôt [`augustindurand18-design/gambling`](https://github.com/augustindurand18-design/gambling).

## Structure

```
index.html      → toute la page (nav, hero, sections, footer)
css/style.css   → design system (couleurs, typographie, composants)
js/main.js      → menu mobile, formulaire liste d'attente, animations au scroll
assets/         → favicon + image de partage (SVG, pas de dépendance externe)
```

## Lancer en local

Aucune dépendance à installer. Depuis ce dossier :

```bash
python3 -m http.server 4173
```

puis ouvrir `http://localhost:4173`. (Un `.claude/launch.json` est déjà en
place si tu relances une session Claude Code — la commande `run` ou le bouton
de preview du panneau navigateur suffit.)

## Ce qui reste à faire avant la mise en ligne

- **Formulaire de liste d'attente** : les e-mails sont pour l'instant
  enregistrés dans `localStorage` (voir le commentaire dans `js/main.js`,
  fonction `saveEmailLocally`). À remplacer par un vrai envoi réseau
  (Supabase — vous avez déjà le projet du repo `gambling` —, ou un simple
  webhook/Resend) une fois le serveur choisi.
- **Nom définitif** : « Lockd » est le nom de travail dans le repo, en attente
  de vérification INPI / domaine / App Store. Un simple rechercher-remplacer
  dans `index.html` suffira si le nom change.
- **Pages légales** : `conditions-utilisation.html` et
  `politique-confidentialite.html` sont rédigées et branchées depuis le
  footer. Il reste à compléter l'identité de la société (raison sociale,
  SIRET, adresse du siège, capital social — voir les encarts `legal-todo`
  en haut de chaque page) dès l'immatriculation, et à remplacer l'adresse
  de contact provisoire par une adresse dédiée une fois le domaine choisi.
- **Vraies captures d'écran** : le mockup du hero est recréé en CSS/HTML
  (l'interface iOS n'existe pas encore). À remplacer par de vrais screenshots
  une fois l'UI construite.
- **Analytics** : rien n'est branché (pas de Google Analytics / Plausible /
  TelemetryDeck) — à ajouter selon ce que vous utilisez déjà côté app.

## Notes de contenu

Tous les chiffres affichés (plafond 100 €/objectif, 25 % reversés à
l'association) viennent des décisions déjà actées dans `CLAUDE.md` du repo
`gambling`. Si ces valeurs changent côté produit, il faut les mettre à jour
ici aussi — elles ne sont pas connectées à une source commune.

**L'abonnement (25 €→5 €/mois) a été retiré de la page** — plus aucune
mention du prix ou de la remise d'assiduité. Reste uniquement le mécanisme de
mise (montant par objectif, part reversée à l'association).
