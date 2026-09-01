import type { Messagerie } from './messagerie.js'
import { env } from '../env.js'

/**
 * Envoi de courriels par Resend.
 *
 * Aucun paquet npm : l'API tient en une requête HTTP, et une dépendance de plus
 * serait une surface de plus à mettre à jour pour un objet JSON à trois champs.
 * `fetch` est natif depuis Node 18.
 *
 * Le SMS reste NON servi ici, et c'est délibéré : Resend n'en envoie pas.
 * Rendre `true` pour faire propre annoncerait un envoi qui n'a pas lieu — le
 * mensonge exact que cette couture existe pour empêcher. Les codes
 * d'invitation continueront donc de se transmettre à la main jusqu'à ce qu'un
 * fournisseur de SMS soit choisi ; ce que l'écran dit déjà.
 */
export class MessagerieResend implements Messagerie {
  constructor(
    private readonly cle: string,
    private readonly expediteur: string,
  ) {}

  async envoyerSms(): Promise<boolean> {
    return false
  }

  async envoyerEmail(
    destinataire: string,
    sujet: string,
    corps: { texte: string; html: string },
  ): Promise<boolean> {
    try {
      const reponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.cle}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.expediteur,
          to: [destinataire],
          subject: sujet,
          // Les DEUX. Les clients modernes affichent le HTML, où le lien vit
          // dans un attribut ; les autres retombent sur le texte. Envoyer le
          // seul HTML priverait les seconds, envoyer le seul texte est ce qui
          // a cassé le parcours en production.
          html: corps.html,
          text: corps.texte,
          /*
            `List-Unsubscribe`, ET SURTOUT PAS `List-Unsubscribe-Post`.

            C'est le second en-tête qui déclare le « un clic » et autorise un
            client à POSTer sans montrer la page. Sans lui, le client OUVRE
            le lien — et l'on retombe sur ce que le pied de message a déjà
            choisi : le lien mène au produit, le geste reste un geste. Le
            désabonnement le plus dangereux est celui que personne n'a
            demandé, et un aperçu de messagerie qui précharge une URL
            agissante le provoquerait.

            Le bouton natif du client apparaît quand même : c'est le geste le
            plus visible, et il ouvre le réglage au lieu de le basculer.
          */
          headers: {
            'List-Unsubscribe': `<${env.CLIENT_ORIGIN}/app>`,
          },
        }),
      })

      if (!reponse.ok) {
        /**
         * Le corps de la RÉPONSE est journalisé, jamais celui de la requête.
         *
         * Resend explique ses refus — domaine non vérifié, destinataire
         * interdit sur le bac à sable, quota — et sans ce texte on ne saurait
         * pas lequel. La requête, elle, porte le lien de réinitialisation :
         * l'écrire dans le journal distribuerait la clé du compte à tous ceux
         * qui lisent les journaux, et ils sont plus nombreux que ceux qui
         * lisent la base.
         */
        const detail = await reponse.text().catch(() => '')
        console.error(`Resend a refusé l'envoi — ${reponse.status} ${detail.slice(0, 300)}`)
        return false
      }

      return true
    } catch (err) {
      /**
       * JAMAIS D'EXCEPTION, comme le contrat de la couture l'exige. Une panne
       * réseau ne doit pas emporter la demande de réinitialisation : l'appelant
       * rend le même 202 qu'en temps normal, et l'utilisateur redemandera un
       * lien plutôt que de tomber sur une erreur qui lui apprendrait, au
       * passage, que son adresse est connue.
       */
      console.error('Resend injoignable', err)
      return false
    }
  }
}
