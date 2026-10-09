#!/usr/bin/env node
/**
 * AUCUNE IMAGE DE SERVICE NE SE TIRE EN ANONYME.
 *
 * LE NOM DIT LE REFUS, PAS LE REMÈDE. Ce fichier s'est d'abord appelé
 * `check-images-authentifiees` — il portait le nom de l'UNE des deux issues,
 * celle qu'on n'a finalement pas prise. Une garde se nomme d'après ce qu'elle
 * interdit, sinon elle ment dès qu'on répare autrement.
 *
 * ═══ LE DÉFAUT, PAYÉ EN PRODUCTION GELÉE ═══
 *
 * Le 2026-10-09, la chaîne de `main` a rougi deux fois d'affilée sur
 * `serveur — sur un vrai Postgres`, à l'étape `Initialize containers` :
 *
 *     toomanyrequests: You have reached your unauthenticated pull rate limit.
 *
 * Aucun défaut de code — la même arborescence était passée vingt minutes plus
 * tôt sur la chaîne de la PR, et 969/969 en local. Docker Hub compte les tirages
 * ANONYMES par adresse IP, et cinq exécutions dans la journée avaient épuisé le
 * quota de la machine d'exécution. Le travail `ce rouge gèle la production` a
 * fait son office : le déploiement est resté bloqué jusqu'à ce que le quota se
 * reconstitue, une heure plus tard.
 *
 * Ce n'est pas un incident, c'est une limite structurelle : elle reviendra au
 * sixième tirage d'une journée chargée, et elle gèlera la production à chaque
 * fois.
 *
 * ═══ POURQUOI UNE ÉTAPE DE CONNEXION NE SUFFIT PAS ═══
 *
 * La réponse qui vient à l'esprit — `docker/login-action` en première étape —
 * NE MARCHE PAS pour un conteneur de service, et c'est le cœur de cette garde.
 * Le cycle d'un travail est : `Set up job`, puis `Initialize containers`, puis
 * les étapes. Les images des services sont tirées à la DEUXIÈME phase, avant
 * que la moindre étape n'ait tourné. Une connexion posée en étape arrive après
 * la bataille.
 *
 * Ce qui marche est la clé `credentials:` posée SUR le service : la machine
 * d'exécution s'en sert pendant `Initialize containers`, au bon moment.
 *
 * ═══ CE QUE CETTE GARDE REFUSE, ET CE QU'ELLE LAISSE PASSER ═══
 *
 * Elle refuse toute image de service tirée du registre par défaut — celui dont
 * le nom ne porte pas d'hôte, comme `postgres:17-alpine` — sans `credentials:`
 * en regard. Elle LAISSE PASSER une image portant un hôte explicite
 * (`ghcr.io/…`, `public.ecr.aws/…`) : ces registres-là n'ont pas le quota
 * anonyme de Docker Hub, et s'y déplacer est l'autre réponse valable. La garde
 * tient les deux voies ouvertes et n'en impose aucune.
 *
 * Elle ne regarde QUE les conteneurs de service. Une image citée dans un `run:`
 * est tirée par une étape, où `docker/login-action` fonctionne — ce n'est pas le
 * même problème et ce n'est pas le périmètre d'ici.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DOSSIER = '.github/workflows'

/** L'indentation d'une ligne, ou `null` si elle ne porte rien qui compte. */
function retrait(ligne) {
  if (/^\s*(#.*)?$/.test(ligne)) return null
  return ligne.length - ligne.trimStart().length
}

/**
 * Le registre est-il celui par défaut, c'est-à-dire Docker Hub ?
 *
 * La règle du démon : un nom SANS barre oblique est une image officielle, donc
 * `docker.io/library/…`. S'il y a une barre, le premier segment est un hôte de
 * registre quand il porte un point ou un deux-points, ou vaut `localhost` ;
 * sinon c'est un espace de noms Docker Hub (`bitnami/postgresql`).
 *
 * LE DEUX-POINTS NE SE CHERCHE QUE DANS UN PREMIER SEGMENT SUIVI D'UNE BARRE.
 * Premier jet : `image.split('/')[0].includes(':')`. Sur `postgres:17-alpine`,
 * sans barre, le premier segment est le nom ENTIER — tag compris — et son
 * deux-points le faisait passer pour un hôte. La garde est née VERTE sur deux
 * services qu'elle devait refuser. C'est l'essai à blanc qui l'a dit, pas la
 * relecture.
 */
function tireDeDockerHub(image) {
  const segments = image.split('/')
  if (segments.length === 1) return true
  const premier = segments[0]
  return !(premier.includes('.') || premier.includes(':') || premier === 'localhost')
}

/**
 * Les services déclarés dans un fichier, avec leur image et leur ligne.
 *
 * Marche par RETRAIT plutôt que par analyse YAML — le dépôt n'embarque aucun
 * analyseur, et en ajouter un pour cette seule garde coûterait plus qu'il ne
 * rapporte. Le prix de ce choix est qu'un fichier mis en forme autrement (YAML
 * en accolades, ancres) échapperait à la marche ; c'est pourquoi la garde
 * REFUSE un `services:` dont elle ne tire aucun service, plutôt que de se taire.
 */
function servicesDe(texte, fichier) {
  const lignes = texte.split('\n')
  const trouves = []
  const blocsVus = []

  for (let i = 0; i < lignes.length; i += 1) {
    const ouverture = /^(\s*)services:\s*$/.exec(lignes[i])
    if (!ouverture) continue

    const retraitDuBloc = ouverture[1].length
    const debutDuBloc = i + 1
    let fin = lignes.length
    for (let j = debutDuBloc; j < lignes.length; j += 1) {
      const r = retrait(lignes[j])
      if (r !== null && r <= retraitDuBloc) {
        fin = j
        break
      }
    }

    /*
      Le retrait d'un service est celui de la PREMIÈRE ligne porteuse du bloc.
      Le déduire plutôt que de le supposer à deux espaces : le dépôt n'impose
      aucune mise en forme, et une garde qui suppose finirait par se taire.
    */
    let retraitDuService = null
    for (let j = debutDuBloc; j < fin; j += 1) {
      const r = retrait(lignes[j])
      if (r !== null) {
        retraitDuService = r
        break
      }
    }

    const servicesDuBloc = []
    for (let j = debutDuBloc; j < fin; j += 1) {
      const entree = /^(\s*)([A-Za-z_][\w-]*):\s*$/.exec(lignes[j])
      if (!entree || entree[1].length !== retraitDuService) continue

      let finDuService = fin
      for (let k = j + 1; k < fin; k += 1) {
        const r = retrait(lignes[k])
        if (r !== null && r <= retraitDuService) {
          finDuService = k
          break
        }
      }

      const corps = lignes.slice(j + 1, finDuService)
      const image = corps
        .map((l) => /^\s*image:\s*(\S+)\s*$/.exec(l))
        .find(Boolean)
      const aDesIdentifiants = corps.some((l) => /^\s*credentials:\s*$/.test(l))

      servicesDuBloc.push({
        fichier,
        nom: entree[2],
        ligne: j + 1,
        image: image ? image[1] : null,
        aDesIdentifiants,
      })
    }

    blocsVus.push({ ligne: i + 1, compte: servicesDuBloc.length })
    trouves.push(...servicesDuBloc)
  }

  return { services: trouves, blocsVus }
}

const plaintes = []
let compteDesServices = 0

for (const nom of readdirSync(DOSSIER).filter((f) => /\.ya?ml$/.test(f)).sort()) {
  const chemin = join(DOSSIER, nom)
  const { services, blocsVus } = servicesDe(readFileSync(chemin, 'utf8'), chemin)
  compteDesServices += services.length

  for (const bloc of blocsVus) {
    if (bloc.compte === 0) {
      plaintes.push(
        `${chemin}:${bloc.ligne} — un bloc \`services:\` dont la marche ne tire aucun ` +
          `service. La mise en forme a changé et cette garde ne la lit plus : ` +
          `la corriger, ne pas la contourner.`,
      )
    }
  }

  for (const s of services) {
    if (!s.image) {
      plaintes.push(`${chemin}:${s.ligne} — le service \`${s.nom}\` ne déclare aucune image.`)
      continue
    }
    if (tireDeDockerHub(s.image) && !s.aDesIdentifiants) {
      plaintes.push(
        `${chemin}:${s.ligne} — le service \`${s.nom}\` tire \`${s.image}\` du registre ` +
          `par défaut SANS \`credentials:\`. Le quota anonyme de Docker Hub se compte ` +
          `par adresse IP et gèle la production quand il s'épuise. Deux issues : poser ` +
          `\`credentials:\` sur ce service, ou nommer un registre sans quota anonyme ` +
          `(\`public.ecr.aws/docker/library/…\`, \`ghcr.io/…\`).`,
      )
    }
  }
}

/*
  LA VACUITÉ EST UN REFUS, et elle se dit APRÈS les plaintes précises.

  Zéro service trouvé a deux causes opposées : les services ont disparu du
  dépôt — et cette garde doit partir avec eux — ou la marche ne lit plus la mise
  en forme, auquel cas elle serait VERTE SUR UN DÉPÔT FAUTIF. Une garde qui ne
  mesure rien ne prouve rien ; celle-ci refuse plutôt que de se taire.

  L'ORDRE A ÉTÉ CORRIGÉ À L'ESSAI. Ce contrôle sortait en premier, et avalait la
  plainte précise qu'un bloc illisible venait de produire — l'opérateur lisait
  « aucun service trouvé » là où la garde savait dire quelle ligne. Mesuré sur
  un `services:` écrit en accolades.
*/
if (plaintes.length === 0 && compteDesServices === 0) {
  console.error(
    `✗ tirages anonymes — aucun conteneur de service trouvé dans ${DOSSIER}/. ` +
      `Une garde qui ne mesure rien est verte par vacuité : soit les services ont ` +
      `disparu et cette garde doit partir, soit la marche est cassée.`,
  )
  process.exit(1)
}

if (plaintes.length > 0) {
  console.error(`✗ tirages anonymes — ${plaintes.length} service(s) en cause :\n`)
  for (const p of plaintes) console.error(`  ${p}`)
  process.exit(1)
}

console.log(`✓ tirages anonymes — ${compteDesServices} conteneur(s) de service, aucun tirage anonyme`)
