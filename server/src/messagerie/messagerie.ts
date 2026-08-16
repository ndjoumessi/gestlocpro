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
}

/**
 * La messagerie du serveur.
 *
 * Une seule instance, choisie ici. Le jour où un fournisseur est branché, cette
 * ligne change et rien d'autre — c'est la seule promesse que fait une couture,
 * et elle ne vaut que si personne ne contourne cette fonction.
 */
let messagerie: Messagerie = new MessagerieDeJournal()

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
