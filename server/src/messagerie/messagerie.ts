import { env } from '../env.js'
import { MessagerieResend } from './resend.js'
import { MessagerieTwilio } from './twilio.js'

/**
 * Envoi de messages courts, derrière une couture.
 *
 * Le produit doit pouvoir transmettre un code d'invitation par SMS. Le choix du
 * fournisseur — Twilio, Africa's Talking, un contrat opérateur — n'est pas
 * arrêté, et il ne doit pas l'être pour que le reste du code s'écrive : la
 * route d'invitation n'a pas à savoir qui porte le message.
 *
 * L'interface tient en une méthode. C'est délibéré : une couture large invente
 * des besoins qu'on n'a pas encore — accusés de réception, modèles, campagnes —
 * et chacun devient une contrainte pour le fournisseur qu'on choisira.
 */
export interface Messagerie {
  /**
   * Rend `true` si le message est PARTI, `false` sinon.
   *
   * Jamais d'exception : un code d'invitation reste valable même si le SMS
   * échoue — le propriétaire peut le dicter. Faire échouer l'émission parce que
   * l'envoi a échoué perdrait le code au lieu de sauver le message.
   */
  envoyerSms(destinataire: string, texte: string): Promise<boolean>

  /**
   * Rend `true` si le courriel est PARTI, `false` sinon. Mêmes règles que le
   * SMS : jamais d'exception, et le `false` se dit à l'écran.
   *
   * La couture s'élargit d'une méthode parce qu'un besoin réel l'exige — la
   * réinitialisation d'un mot de passe ne peut pas passer par un SMS, dont le
   * corps ne porterait pas un lien sans le tronquer, et dont le coût par envoi
   * se paie sur une opération qu'un utilisateur répète quand il doute. Elle ne
   * s'élargit pas d'un octet de plus : ni pièce jointe, ni modèle, ni accusé de
   * lecture, tant que rien ne les réclame.
   *
   * DEUX CORPS, et c'est un incident de production qui l'impose. Le premier
   * message n'avait qu'une version texte ; son lien de 112 caractères a été
   * mutilé quelque part entre l'envoi et le navigateur — repli de ligne,
   * encodage, ou auto-détection qui décide seule où une URL s'arrête. L'écran
   * a rendu « lien expiré » sans qu'aucune requête ne parte, et chacune des
   * pièces était pourtant juste : le jeton émis, le paquet client servi, le
   * contrôle qui le lit.
   *
   * Dans une version HTML, l'adresse vit dans un ATTRIBUT. Aucun repli ne la
   * coupe, aucune heuristique n'a à deviner où elle finit. La version texte
   * reste jointe pour les clients qui n'affichent pas le HTML : elle n'est plus
   * la seule chance du lien, seulement la dernière.
   */
  envoyerEmail(
    destinataire: string,
    sujet: string,
    corps: { texte: string; html: string },
  ): Promise<boolean>
}

/**
 * Adaptateur de journal : n'envoie RIEN, et le dit.
 *
 * Tant qu'aucun fournisseur n'est configuré, le message est écrit dans le
 * journal et la méthode rend `false`. Ce `false` est le cœur de la couture :
 * l'appelant sait que rien n'est parti, et l'écran peut dire « transmettez-le
 * vous-même » au lieu de « envoyé par SMS ».
 *
 * Rendre `true` ici aurait été plus simple et aurait produit exactement le
 * mensonge qu'on retire partout ailleurs : un succès affiché que rien ne
 * recouvre.
 *
 * Le texte n'est PAS journalisé : il porte le code d'invitation, qui donne
 * accès à un parc. Un journal se lit par bien plus de gens qu'une base.
 */
export class MessagerieDeJournal implements Messagerie {
  async envoyerSms(destinataire: string, texte: string): Promise<boolean> {
    // Le numéro est tronqué : il identifie une personne, et le journal n'a pas
    // à le porter en entier pour qu'on sache qu'un envoi a été tenté.
    const masque = destinataire.slice(0, 4) + '…' + destinataire.slice(-2)
    console.log(`SMS non envoyé — aucun fournisseur configuré — vers ${masque} (${texte.length} car.)`)
    return false
  }

  async envoyerEmail(
    destinataire: string,
    sujet: string,
    corps: { texte: string; html: string },
  ): Promise<boolean> {
    /**
     * Ni le corps ni l'adresse entière ne sont journalisés.
     *
     * Le corps porte un lien de réinitialisation — c'est-à-dire, le temps de sa
     * validité, la clé du compte. L'écrire dans le journal reviendrait à
     * distribuer cette clé à tous ceux qui lisent les journaux, et ils sont
     * plus nombreux que ceux qui lisent la base. Le sujet, lui, ne dit rien de
     * secret et aide à savoir quel envoi a été tenté.
     */
    const [avant = '', apres = ''] = destinataire.split('@')
    const masque = `${avant.slice(0, 2)}…@${apres}`
    console.log(
      `Courriel non envoyé — aucun fournisseur configuré — vers ${masque} — « ${sujet} » (${corps.texte.length} car.)`,
    )
    return false
  }
}

/**
 * DEUX FOURNISSEURS, UN AIGUILLAGE.
 *
 * Resend envoie des courriels et pas de SMS ; Twilio l'inverse. Une seule
 * instance ne pouvait donc plus servir les deux, et le choix ne pouvait plus
 * être un ternaire sur une clé — c'est ce que ce composeur remplace.
 *
 * Il ne fait RIEN d'autre qu'aiguiller. Pas de repli automatique d'un canal sur
 * l'autre : un SMS qui échoue ne devient pas un courriel. Le destinataire d'un
 * SMS est un NUMÉRO, celui d'un courriel une ADRESSE ; les substituer
 * n'enverrait rien, et le `true` rendu serait le mensonge qu'on traque.
 */
export function composerLaMessagerie(sms: Messagerie, courriel: Messagerie): Messagerie {
  return {
    envoyerSms: (destinataire, texte) => sms.envoyerSms(destinataire, texte),
    envoyerEmail: (destinataire, sujet, corps) =>
      courriel.envoyerEmail(destinataire, sujet, corps),
  }
}

/**
 * La messagerie du serveur.
 *
 * Une seule instance, composée ici. Chaque canal tombe INDÉPENDAMMENT sur le
 * journal quand sa configuration manque : un serveur qui sait envoyer des
 * courriels et pas de SMS est l'état normal tant qu'aucun compte Twilio n'est
 * ouvert, et il ne doit pas perdre ses courriels pour autant.
 *
 * LES TROIS VARIABLES DE TWILIO SONT EXIGÉES ENSEMBLE. Deux sur trois donnent
 * un adaptateur qui rend 401 ou 400 à chaque envoi — un fournisseur qui a l'air
 * branché et n'envoie rien, ce qui est pire que pas de fournisseur du tout : le
 * journal du repli, lui, DIT qu'il n'envoie pas.
 */
const parCourriel: Messagerie = env.RESEND_API_KEY
  ? new MessagerieResend(env.RESEND_API_KEY, env.EMAIL_FROM)
  : new MessagerieDeJournal()

const parSms: Messagerie =
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_SMS_FROM
    ? new MessagerieTwilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_SMS_FROM)
    : new MessagerieDeJournal()

let messagerie: Messagerie = composerLaMessagerie(parSms, parCourriel)

export function laMessagerie(): Messagerie {
  return messagerie
}

/** Réservé aux tests : remplace la messagerie le temps d'un cas. */
export function remplacerMessagerie(remplacante: Messagerie): () => void {
  const precedente = messagerie
  messagerie = remplacante
  return () => {
    messagerie = precedente
  }
}
