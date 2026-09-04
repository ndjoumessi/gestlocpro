/**
 * QUI NE VOIT PAS CE QU'IL DEVRAIT VOIR — UN RELEVÉ, PAS UN CORRECTIF.
 *
 * ═══ LE DÉFAUT QUI A LAISSÉ DES TRACES ═══
 *
 * Jusqu'au commit `efa45c9` (2026-09-03), créer un immeuble n'écrivait aucune
 * ligne dans `MembershipBuilding`. Un gestionnaire BORNÉ — `scope: 'declared'`,
 * qui ne voit que ce qu'on lui a confié — déclarait donc un immeuble, l'écran le
 * montrait le temps de la réponse, et il disparaissait au rechargement suivant.
 * Sans erreur, sans message : la liste revenait vide.
 *
 * La création est réparée. LES LIGNES D'ALORS NE LE SONT PAS, et rien dans ce
 * dépôt ne peut les réparer tout seul.
 *
 * ═══ POURQUOI CE SCRIPT NE CORRIGE RIEN ═══
 *
 * `Building` NE PORTE PAS SON CRÉATEUR. Le modèle a un `parkId`, un nom, un
 * quartier, une date — pas d'auteur. Il est donc IMPOSSIBLE de savoir, après
 * coup, quel immeuble un gestionnaire donné a déclaré. Deviner d'après les
 * dates serait inventer.
 *
 * Ce script RELÈVE : pour chaque gestionnaire borné, les immeubles de son parc
 * qui ne lui sont pas confiés. C'est une liste de CANDIDATS que le propriétaire
 * arbitre depuis `/app/acces`, pas une liste de torts.
 *
 * IL N'ÉCRIT RIEN. Pas une ligne, pas une correction. Rattacher un immeuble à
 * quelqu'un est un pouvoir donné sur des loyers et des cautions ; c'est une
 * décision, elle appartient au propriétaire, et le registre des décisions la
 * consigne quand elle passe par le produit.
 *
 * ═══ USAGE ═══
 *
 *     DATABASE_URL=… npm --prefix server run immeubles:non-confies
 */
import { prisma } from '../db.js'

async function relever(): Promise<void> {
  const bornes = await prisma.membership.findMany({
    where: { role: 'manager', scope: 'declared', status: 'active' },
    select: {
      id: true,
      parkId: true,
      user: { select: { email: true, fullName: true } },
      park: { select: { name: true } },
      buildings: { select: { buildingId: true } },
      /* LES LOGEMENTS AUSSI, et pas pour les lister : `MembershipUnit` confie des
         logements INDIVIDUELS. Sans ce compte, un gestionnaire à qui l'on n'a
         confié que des logements ressortirait « ne voit RIEN », ce qui serait
         faux — il voit exactement ce qu'on lui a donné. */
      units: { select: { unitId: true } },
    },
  })

  if (bornes.length === 0) {
    console.log('Aucun gestionnaire borné actif. Rien à relever.')
    return
  }

  let signales = 0
  for (const adhesion of bornes) {
    const confies = new Set(adhesion.buildings.map((l) => l.buildingId))
    const duParc = await prisma.building.findMany({
      where: { parkId: adhesion.parkId },
      select: { id: true, name: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    const absents = duParc.filter((i) => !confies.has(i.id))
    if (absents.length === 0) continue

    signales++
    /* LE CAS À ZÉRO EST LE SYMPTÔME EXACT du défaut réparé : un gestionnaire
       borné qui ne voit RIEN alors que son parc porte des immeubles. Les autres
       cas sont peut-être des périmètres voulus — on ne les distingue pas. */
    const symptome =
      confies.size === 0 && adhesion.units.length === 0 ? '  ← ne voit RIEN de ce parc' : ''
    console.log(
      `\n${adhesion.user.fullName} <${adhesion.user.email}> · parc « ${adhesion.park.name} »` +
        `\n  immeubles confiés : ${confies.size} · non confiés : ${absents.length}` +
        ` · logements confiés : ${adhesion.units.length}${symptome}`,
    )
    for (const immeuble of absents)
      console.log(`    ${immeuble.createdAt.toISOString().slice(0, 10)}  ${immeuble.name}`)
  }

  console.log(
    `\n${bornes.length} gestionnaire(s) borné(s) examiné(s), ${signales} avec des immeubles non confiés.` +
      "\nCe relevé ne dit PAS qu'il y a faute : un périmètre étroit peut être voulu." +
      "\nCe qu'il ne peut pas dire non plus : qui a créé quoi — `Building` ne porte pas son auteur." +
      '\nArbitrage depuis /app/acces, par le propriétaire.',
  )
}

relever()
  .catch((erreur: unknown) => {
    console.error('relevé impossible :', erreur)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
