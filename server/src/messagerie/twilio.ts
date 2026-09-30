import type { Messagerie } from './messagerie.js'

/**
 * Envoi de SMS par Twilio.
 *
 * ═══ CE QU'IL DÉBLOQUE ═══
 *
 * `envoyerSms` était appelé à deux endroits — le code d'invitation et la
 * relance du locataire en retard — et rendait `false` partout : la couture
 * existait, aucun fournisseur ne la servait. Le journal de production écrivait
 * « SMS non envoyé — aucun fournisseur configuré ». Sur le marché visé, le SMS
 * est le canal qui atteint les gens.
 *
 * AUCUN PAQUET NPM, comme pour Resend : l'API tient en une requête HTTP, et une
 * dépendance de plus serait une surface de plus à tenir à jour pour trois
 * champs de formulaire. `fetch` est natif depuis Node 18.
 *
 * ═══ DEUX PARTICULARITÉS DE CETTE API, ET ELLES SE PAIENT ═══
 *
 * L'AUTHENTIFICATION EST « BASIC », pas un jeton porteur : identifiant de
 * compte et jeton, concaténés et encodés. Poser `Bearer` rendrait 401 sur
 * chaque envoi — et comme le contrat interdit de lever, l'échec serait MUET.
 *
 * LE CORPS EST UN FORMULAIRE, pas du JSON. Un `JSON.stringify` bien intentionné
 * rend 400 sur tous les envois, avec le même silence.
 *
 * ═══ LE COURRIEL N'EST PAS SERVI ICI ═══
 *
 * Twilio n'en envoie pas — pas par cette API. Rendre `true` pour faire propre
 * annoncerait un envoi qui n'a pas lieu : le mensonge exact que cette couture
 * existe pour empêcher. C'est le miroir de `MessagerieResend.envoyerSms`, et
 * c'est pourquoi les deux se COMPOSENT au lieu de se remplacer.
 */
export class MessagerieTwilio implements Messagerie {
  constructor(
    private readonly compte: string,
    private readonly jeton: string,
    private readonly expediteur: string,
    /**
     * Le numéro WhatsApp, quand il y en a un.
     *
     * FACULTATIF, ET PAS PAR COMMODITÉ : un compte Twilio ouvert pour le SMS
     * n'a pas forcément de numéro WhatsApp activé. Absent, `envoyerWhatsApp`
     * rend `false` et le dit — plutôt que d'émettre depuis l'expéditeur SMS,
     * que Meta refuserait avec un code que personne n'irait lire.
     */
    private readonly expediteurWhatsApp?: string | undefined,
  ) {}

  async envoyerSms(destinataire: string, texte: string): Promise<boolean> {
    return this.envoyer('SMS', destinataire, this.expediteur, texte)
  }

  /**
   * WHATSAPP PAR LA MÊME REQUÊTE, au préfixe près.
   *
   * Twilio distingue les deux transports au `To` et au `From` : `whatsapp:`
   * devant les deux numéros, et rien d'autre ne change — même point d'entrée,
   * même authentification « basic », même corps de formulaire.
   *
   * CE QUI PEUT LE FAIRE ÉCHOUER, ET QUE LE CODE NE PEUT PAS RÉPARER. Hors
   * d'une fenêtre de 24 h après le dernier message du destinataire, Meta exige
   * un MODÈLE qu'elle a approuvé. Une relance de loyer est non sollicitée :
   * sans modèle, la réponse porte le code 63016 et cette méthode rend `false`.
   * Le journal l'écrit — c'est précisément à quoi sert de relever le `code`
   * plutôt que le message.
   */
  async envoyerWhatsApp(destinataire: string, texte: string): Promise<boolean> {
    if (!this.expediteurWhatsApp) {
      const masque = destinataire.slice(0, 4) + '…' + destinataire.slice(-2)
      console.log(`WhatsApp non envoyé — aucun expéditeur configuré — vers ${masque}`)
      return false
    }
    return this.envoyer(
      'WhatsApp',
      `whatsapp:${destinataire}`,
      `whatsapp:${this.expediteurWhatsApp}`,
      texte,
    )
  }

  /**
   * L'ENVOI, UNE FOIS POUR LES DEUX TRANSPORTS.
   *
   * Les deux méthodes publiques ne diffèrent que par un préfixe sur deux
   * numéros. Deux corps jumeaux auraient divergé au premier ajustement — et
   * l'ajustement le plus probable est justement celui du journal d'erreur, qui
   * est la seule chose qui rende un `false` diagnosticable.
   *
   * `canal` ne sert QU'À ÉCRIRE : sans lui, un refus vers un numéro
   * indisponible sur WhatsApp se lirait « SMS refusé », et l'exploitant
   * chercherait la panne du mauvais côté.
   */
  private async envoyer(
    canal: 'SMS' | 'WhatsApp',
    destinataire: string,
    expediteur: string,
    texte: string,
  ): Promise<boolean> {
    /* Le numéro tronqué, jamais entier : il identifie une personne, et un
       journal se lit par bien plus de gens qu'une base. */
    const masque = destinataire.slice(0, 4) + '…' + destinataire.slice(-2)
    try {
      const reponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.compte}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.compte}:${this.jeton}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: destinataire,
            From: expediteur,
            Body: texte,
          }).toString(),
        },
      )
      if (!reponse.ok) {
        /*
          LE MOTIF DU REFUS, JAMAIS LE MESSAGE.

          Twilio rend un `code` numérique documenté — 21608 « numéro non
          vérifié », 21211 « numéro invalide », 20003 « authentification »,
          63016 « message libre hors fenêtre de 24 h », qui est le refus que
          toute relance WhatsApp reçoit tant qu'aucun modèle n'est approuvé.
          Sans lui, un `false` répété ne se diagnostique pas ; avec le corps
          entier, on écrirait le texte, donc le code d'invitation.
        */
        const motif = await reponse
          .json()
          .then((c: unknown) => (c as { code?: number }).code ?? '—')
          .catch(() => '—')
        console.error(
          `${canal} refusé par Twilio — vers ${masque} — HTTP ${reponse.status}, code ${motif}`,
        )
        return false
      }
      return true
    } catch {
      /* JAMAIS D'EXCEPTION : un code d'invitation reste valable même si le SMS
         échoue, et le propriétaire peut le dicter. Lever ici perdrait le code
         au lieu de sauver le message. La cause n'est pas journalisée — elle
         peut porter l'URL, donc l'identifiant de compte. */
      console.error(`${canal} non parti — Twilio injoignable — vers ${masque}`)
      return false
    }
  }

  async envoyerEmail(): Promise<boolean> {
    return false
  }
}
