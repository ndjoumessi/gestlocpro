import type { MessageKey } from '@/i18n/I18nProvider'

/**
 * Validateurs partagés par la connexion et l'inscription.
 *
 * Ils renvoient une **clé de message**, pas une chaîne : la traduction se fait
 * au rendu, si bien qu'une erreur déjà affichée change de langue avec le reste
 * de l'interface au lieu de rester figée dans celle de la saisie.
 */
export type FieldError = MessageKey | null

// Volontairement permissif : le rôle d'un formulaire n'est pas de refuser une
// adresse exotique mais valide. Le vrai contrôle est le lien de confirmation.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateName(value: string): FieldError {
  return value.trim().length < 2 ? 'auth.errors.nameRequired' : null
}

export function validateEmail(value: string): FieldError {
  if (!value.trim()) return 'auth.errors.emailRequired'
  return EMAIL.test(value.trim()) ? null : 'auth.errors.emailInvalid'
}

/**
 * LA LONGUEUR MINIMALE VIT ICI, ET NULLE PART AILLEURS.
 *
 * Elle était écrite deux fois : le `8` de ce fichier, et le « 8 » du message
 * `auth.errors.passwordShort`. Deux littéraux pour une règle, dans deux langues,
 * donc trois endroits à changer d'un coup et rien pour le rappeler. Le seuil est
 * maintenant interpolé dans les messages, et les écrans le passent depuis cette
 * constante — la faire bouger déplace la règle et sa formulation ensemble.
 */
export const LONGUEUR_MINIMALE_DU_MOT_DE_PASSE = 8

/**
 * ═══ UN CHAMP VIDE NE SE REPROCHE PAS DE LA MÊME FAÇON SELON L'ÉCRAN ═══
 *
 * Le message était unique : « Choisissez un mot de passe. » La CONNEXION
 * l'affichait donc aussi — on n'y choisit rien, on saisit celui qu'on a déjà, et
 * s'entendre dire « choisissez » au moment où l'on se connecte évoque une
 * création de compte. Le mot était juste sur deux écrans et faux sur le
 * troisième, celui qu'on ouvre le plus souvent.
 *
 * `requireStrong` DÉCIDE DONC AUSSI DU VERBE, et ce n'est pas un raccourci : le
 * drapeau ne dit pas « sois sévère », il dit « ce mot de passe est NOUVEAU ».
 * Les deux conséquences en découlent ensemble — on exige une longueur parce
 * qu'on le crée, et on dit « choisissez » pour la même raison. Un futur écran de
 * changement de mot de passe porterait les deux champs et les deux verbes,
 * chacun juste, sans rien ajouter ici.
 */
export function validatePassword(value: string, { requireStrong = false } = {}): FieldError {
  if (!value) {
    return requireStrong ? 'auth.errors.passwordChoose' : 'auth.errors.passwordEnter'
  }
  if (requireStrong && value.length < LONGUEUR_MINIMALE_DU_MOT_DE_PASSE) {
    return 'auth.errors.passwordShort'
  }
  return null
}

/**
 * Confirmation d'un mot de passe.
 *
 * Le message ne dit pas laquelle des deux saisies est fautive : elles sont
 * masquées, l'utilisateur ne peut de toute façon comparer que ce qu'il retape.
 */
export function validatePasswordConfirmation(value: string, reference: string): FieldError {
  if (!value) return 'auth.errors.confirmRequired'
  return value === reference ? null : 'auth.errors.confirmMismatch'
}

/**
 * Le pays du compte : REQUIS, et rien de plus.
 *
 * Il n'était pas requis, parce que personne n'avait à le toucher — il arrivait
 * pré-rempli, déduit de la devise qu'affichait la vitrine, en prenant le
 * premier pays de la liste qui la porte. Un champ qu'on ne touche pas est un
 * champ qu'on ne lit pas, et sa valeur partait au serveur sans que quiconque
 * l'ait vue : c'est ainsi qu'un parc de Yaoundé est né français.
 *
 * On ne vérifie PAS l'appartenance à `COUNTRIES`, et c'est délibéré. Cette
 * liste compte vingt et un pays *desservis* — ceux dont on connaît la devise,
 * la langue et l'indicatif — quand le formulaire en propose deux cent
 * quarante-deux. Un premier jet exigeait l'appartenance : il interdisait
 * l'inscription à un bailleur de Harare, et c'est un cas existant du harnais
 * qui l'a attrapé. La présence suffit ici ; la forme du code est le contrat du
 * serveur, qui n'exige que deux lettres.
 *
 * `OTHER_COUNTRY` est une réponse : « mon pays n'est pas proposé ». Le
 * formulaire ne transmet alors aucun code plutôt qu'un faux.
 */
export function validateCountry(value: string): FieldError {
  return value ? null : 'auth.errors.countryRequired'
}

/**
 * Jeton de réinitialisation : présent, et rien de plus.
 *
 * Cette fonction jugeait la FORME — seize caractères hexadécimaux, celle du
 * jeton figé de la démonstration, écrite quand aucun serveur n'existait. Le
 * serveur en émet aujourd'hui de quarante-trois en base64url, majuscules et
 * tirets compris : le filtre les rejetait tous, et l'écran « lien expiré »
 * s'affichait sans qu'aucune requête ne parte. Le parcours entier était
 * inatteignable, chaque côté ayant raison dans son coin.
 *
 * Le défaut n'était pas la valeur du motif mais son EXISTENCE ici : le client
 * n'a pas à connaître la forme d'un objet que le serveur seul fabrique. Deux
 * vérités sur la même chose, dont une ignorante, et c'est l'ignorante qui
 * tranchait. Il ne reste donc qu'un contrôle de présence — assez pour éviter un
 * appel vide quand l'adresse est saisie à la main, et la borne haute pour ne
 * pas expédier une URL entière. La validité, elle, ne se sait qu'au serveur.
 */
export function isValidResetToken(token: string | null): boolean {
  return typeof token === 'string' && token.length >= 16 && token.length <= 200
}

/**
 * Longueur maximale d'un numéro en E.164 : quinze chiffres, INDICATIF COMPRIS.
 *
 * C'est la borne de la norme elle-même, et la seule qui vaille pour deux cent
 * quarante-deux pays sans embarquer un plan de numérotation par pays.
 */
const E164_MAX = 15

/**
 * Numéro NATIONAL — l'indicatif vit dans le champ voisin.
 *
 * Le contrôle n'avait qu'un plancher de six chiffres, et aucun plafond :
 * « 6617519232222222222 », dix-neuf chiffres, passait sans un mot. Le formulaire
 * laissait donc continuer, puis le serveur refusait l'E.164 recomposé et l'écran
 * n'annonçait qu'une « erreur inattendue » — exactement le défaut qui avait déjà
 * fait échouer la première inscription du produit, sur le pays cette fois.
 * Valider ce qu'on va envoyer est moins cher que traduire un refus.
 *
 * Le plafond dépend de l'indicatif, puisque les deux voyagent ensemble : il
 * reste au national ce que la norme laisse une fois l'indicatif retiré. `+237`
 * en autorise donc douze, `+1` quatorze. C'est plus permissif que les plans
 * nationaux réels — le Cameroun tient en neuf chiffres — et c'est délibéré :
 * une borne trop serrée refuserait un numéro valide dans un pays dont on n'a
 * pas la règle, ce qui coûte plus qu'un numéro trop long refusé par le serveur.
 */
export function validatePhone(value: string, dial = ''): FieldError {
  const digits = value.replace(/\D/g, '')
  if (!digits) return 'auth.errors.phoneRequired'
  if (digits.length < 6) return 'auth.errors.phoneInvalid'

  const chiffresIndicatif = dial.replace(/\D/g, '').length
  return digits.length + chiffresIndicatif > E164_MAX ? 'auth.errors.phoneTooLong' : null
}

export function validateParkName(value: string): FieldError {
  return value.trim().length < 2 ? 'auth.errors.parkNameRequired' : null
}

/**
 * Code d'invitation : LOC-XXXX-XXXX pour un locataire, GES-XXXX-XXXX pour un
 * gestionnaire.
 *
 * Le motif ne connaissait que `LOC`. Le serveur, lui, préfixe le code par le
 * rôle invité depuis toujours — `creerCode` rend `GES` pour un gestionnaire —
 * si bien qu'un code de gestionnaire parfaitement valide aurait été refusé par
 * l'écran avant qu'aucune requête ne parte. Deux vérités sur la même forme,
 * dont une ignorante, et c'est l'ignorante qui aurait tranché.
 *
 * Les deux préfixes font trois caractères : `formatInviteCode` regroupe donc
 * l'un comme l'autre sans avoir à connaître le rôle.
 */
const INVITE = /^(?:LOC|GES)-[A-Z0-9]{4}-[A-Z0-9]{4}$/i

export function validateInviteCode(value: string): FieldError {
  if (!value.trim()) return 'auth.errors.inviteRequired'
  return INVITE.test(value.trim()) ? null : 'auth.errors.inviteInvalid'
}

/**
 * Met en forme la saisie du code au fil de la frappe : loc4a7b92cd -> LOC-4A7B-92CD
 *
 * La fonction se contente de **regrouper** ce que l'utilisateur a tapé, sans
 * rien préfixer. Une version antérieure ajoutait « LOC- » d'office, puis
 * reconsommait ce préfixe comme saisie au caractère suivant : taper le code
 * lettre à lettre donnait « LOC-LOC4-A7B9 ». Le défaut n'apparaissait pas quand
 * on posait la valeur entière d'un coup, ce qu'aucun utilisateur ne fait.
 *
 * Cette forme est idempotente — la réappliquer à son propre résultat ne change
 * rien — ce qui est la propriété qui manquait.
 */
export function formatInviteCode(value: string): string {
  const clean = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 11)

  return [clean.slice(0, 3), clean.slice(3, 7), clean.slice(7, 11)].filter(Boolean).join('-')
}

/** `true` si aucun champ n'est en erreur. */
export function isClean(errors: Record<string, FieldError>): boolean {
  return Object.values(errors).every((error) => error === null)
}

/**
 * Robustesse d'un mot de passe : 0 = refusé, 3 = robuste.
 *
 * Vit ici et non dans le composant qui l'affiche : c'est une règle de
 * validation, testable sans monter d'interface, et l'y laisser aurait fini par
 * la faire diverger des autres règles du même formulaire.
 *
 * ═══ LE NIVEAU 0 EST EXACTEMENT LE REFUS, ET C'EST STRUCTUREL ═══
 *
 * Le premier palier lit `LONGUEUR_MINIMALE_DU_MOT_DE_PASSE`, la constante que
 * `validatePassword` applique. Score 0 ⟺ trop court ⟺ refusé : l'équivalence
 * tient par construction et non par coïncidence.
 *
 * Elle tenait déjà, mais par un `8` recopié — un troisième littéral à côté de
 * celui du validateur et de ceux des traductions. Rien n'aurait signalé le jour
 * où l'un des deux seuils aurait bougé sans l'autre, et la jauge aurait alors
 * peint en rouge un mot de passe accepté, ou en ambre un mot de passe refusé.
 *
 * Le second palier, lui, reste une valeur À PART : douze caractères ne
 * conditionnent rien, ils distinguent « accepté » de « confortable ». C'est de
 * l'avis, et l'avis n'a pas à s'aligner sur une règle.
 */
export function scorePassword(value: string): 0 | 1 | 2 | 3 {
  let score = 0
  if (value.length >= LONGUEUR_MINIMALE_DU_MOT_DE_PASSE) score++
  if (value.length >= 12) score++
  if (
    /[^a-zA-Z0-9]/.test(value) ||
    (/[0-9]/.test(value) && /[a-z]/.test(value) && /[A-Z]/.test(value))
  )
    score++
  return Math.min(score, 3) as 0 | 1 | 2 | 3
}
