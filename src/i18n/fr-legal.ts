/**
 * LES TROIS PAGES JURIDIQUES ONT LEURS MOTS À PART — et elles-mêmes avec.
 *
 * ═══ CE QUI ÉTAIT MESURÉ ═══
 *
 * `fr.ts` est IMPATIENT : `I18nProvider` l'importe statiquement, donc tout
 * visiteur le télécharge, à toute adresse. `legal`, `privacy` et `terms` y
 * pesaient 231 lignes et 5 955 o compressés — les mentions légales, la
 * politique de confidentialité et les conditions générales, pour quelqu'un qui
 * lit une page de vente et n'ouvrira probablement jamais aucune des trois.
 *
 * ═══ POURQUOI LES MOTS SEULS N'AURAIENT RIEN GAGNÉ ═══
 *
 * Et c'est le point qui a dicté le périmètre du lot. Les trois pages étaient
 * importées STATIQUEMENT dans `App.tsx` : sortir leurs mots du paquet d'entrée
 * en y laissant les écrans qui les lisent n'aurait rien déplacé — Rollup aurait
 * remis les deux ensemble. Les pages partent donc avec leurs mots, derrière une
 * SEULE frontière paresseuse partagée par les trois.
 *
 * ═══ CE QUI RESTE IMPATIENT, ET POURQUOI ═══
 *
 * Quatre clés ont changé de section plutôt que de partir :
 *
 *   · `nav.legalLink`, `nav.privacyLink`, `nav.termsLink` — `PublicFooter` les
 *     rend sur l'accueil, donc elles doivent se lire là où la page ne se lit
 *     pas. Ce sont des libellés de navigation ; `nav` est leur domicile.
 *   · `common.anchorHint` — `SommaireDesRubriques` sert aussi `Manuel`, un
 *     écran applicatif. Laissée ici, elle aurait rendu une chaîne vide sous le
 *     manuel, sans que rien ne rougisse.
 *
 * LES DÉPLACER PLUTÔT QUE LES DÉDOUBLER est imposé par la fusion : elle est de
 * SURFACE. Deux moitiés portant toutes deux une clé `legal` s'écraseraient au
 * lieu de se compléter — `fr.ts` aurait gardé un `legal` réduit à un lien, que
 * ce fichier aurait effacé en arrivant. En vidant les trois sections de tout ce
 * qui doit rester, elles partent ENTIÈRES et la question ne se pose plus.
 *
 * ═══ LA FAUTE QUE CETTE SCISSION REND POSSIBLE ═══
 *
 * Un module du paquet d'entrée qui appellerait `t('legal.quelquechose')`
 * s'exécuterait avant que ce fichier n'existe : `t()` rendrait `''`, et
 * l'écran afficherait un trou. Rien dans le typage ne le dit — `MessageKey`
 * reste dérivé du dictionnaire entier, exprès.
 * `check-dictionnaire-impatient.mjs` est la garde qui le dit à sa place.
 */
export const frLegal = {
  legal: {
    title: 'Mentions légales',
    intro:
      'L’éditeur de GestLocPro, tel que l’établissent son attestation d’immatriculation au Registre national des entreprises et l’annuaire des entreprises, et l’hébergeur du service.',
    publisher: 'Éditeur',
    name: 'Nom',
    tradeName: 'Nom commercial',
    regime: 'Régime',
    legalForm: 'Forme juridique',
    siren: 'SIREN',
    siret: 'SIRET du siège',
    ape: 'Code APE',
    vat: 'TVA',
    director: 'Directeur de la publication',
    nature: 'Nature de l’établissement',
    activity: 'Activité principale',
    address: 'Adresse',
    registration: 'Immatriculation',
    /* LE SOMMAIRE des deux pages longues — voir `SommaireDesRubriques`. Sous
       `legal` et non sous `terms` ou `privacy` : les deux pages le partagent,
       et une clé par page ferait deux mots pour une seule chose. */
    contents: 'Sommaire',
    updatedOn: 'Inscription à jour au {date}',
    /* LA DATE DU DOCUMENT, distincte de celle de l'immatriculation juste
       au-dessus — voir `MentionsLegales.tsx`. */
    pageUpdatedOn: 'Page à jour au {date}',
    hosting: 'Hébergement',
    hostName: 'Raison sociale',
    phone: 'Téléphone',
    email: 'Courriel',
    home: 'Retour à l’accueil',
  },

  privacy: {
    title: 'Politique de confidentialité',
    intro:
      'Ce que GestLocPro fait des données personnelles qu’il reçoit, relevé dans le fonctionnement du service lui-même.',
    updatedOn: 'Relevé au {date}',
    controller: {
      title: 'Responsable du traitement',
      body: 'L’éditeur de GestLocPro : {name}, {form}, SIREN {siren}. Pour toute question sur vos données, ou pour exercer vos droits, écrivez à :',
      email: 'ou par courriel :',
    },
    roles: {
      title: 'Qui décide de quoi',
      account:
        'Pour votre compte — nom, adresse électronique, téléphone, mot de passe, connexions —, l’éditeur est responsable du traitement.',
      rental:
        'Les données qu’un bailleur ou son gestionnaire saisit sur ses locataires, ses logements, ses loyers et ses états des lieux sont traitées pour son compte : le bailleur en est responsable, et l’éditeur agit comme son sous-traitant. Si vous êtes locataire, adressez d’abord vos demandes à votre bailleur.',
    },
    data: {
      title: 'Données traitées',
      account:
        'Compte : nom, adresse électronique, téléphone, pays, langue, mot de passe (conservé haché, jamais en clair), date de lecture de cette politique et choix de la lettre d’information.',
      sessions: 'Connexions : date et navigateur utilisé, sans l’adresse IP.',
      rental:
        'Gestion locative : nom, téléphone et adresse électronique des locataires ; baux, loyers, paiements et dépôts de garantie ; relevés de compteurs ; états des lieux et leurs photos ; demandes de travaux et de documents ; messages et annonces.',
      audit:
        'Journal des opérations : qui a fait quoi, et quand. Il garde le nom d’un locataire après sa suppression.',
      none: 'Aucune donnée bancaire, pièce d’identité ni donnée de santé n’est demandée. Les photos sont réencodées dans le navigateur avant l’envoi, ce qui retire leurs métadonnées, dont la position.',
    },
    purposes: {
      title: 'Pourquoi',
      service:
        'Fournir le service — tenir le compte et la gestion locative, envoyer les courriels de réinitialisation du mot de passe, de suivi des travaux et de relance des loyers : exécution du contrat.',
      security: 'Protéger les comptes — connexions et journal des opérations : intérêt légitime.',
      newsletter:
        'Lettre d’information : votre consentement, retirable depuis le menu de votre compte. Aucune n’est envoyée à ce jour.',
      noTracking: 'Aucun outil de mesure d’audience, aucune publicité, aucune revente de données.',
    },
    recipients: {
      title: 'Destinataires',
      intro: 'Les membres d’un parc en voient les données selon leur rôle. Hors du parc, trois prestataires en reçoivent :',
      hebergement: 'hébergement de l’application, de la base de données et des photos',
      courriels: 'envoi des courriels',
      relais: 'relais technique de l’adresse gestlocpro.vercel.app',
      US: 'États-Unis',
    },
    transfers: {
      title: 'Transferts hors de l’Union européenne',
      body: 'Ces trois prestataires sont établis aux États-Unis. Chacun déclare adhérer au Data Privacy Framework UE–États-Unis, que la Commission européenne a reconnu par sa décision d’adéquation du 10 juillet 2023.',
    },
    retention: {
      title: 'Durée de conservation',
      body: 'Les données sont conservées tant que le compte ou le parc existe. Il n’y a aujourd’hui aucune suppression automatique : une session de connexion expire, mais sa trace est gardée.',
      onRequest:
        'Sur demande écrite, l’éditeur supprime les données dont il est responsable. Celles d’un locataire se suppriment sur instruction de son bailleur.',
    },
    storage: {
      title: 'Cookies et stockage du navigateur',
      cookieLead: 'Un seul cookie :',
      cookieBody: 'Il maintient votre connexion ; strictement nécessaire, il ne demande pas de consentement.',
      preferences: 'Votre navigateur garde aussi vos préférences : thème, langue, région, devise et taux de change.',
      login:
        'Si vous cochez « Rester connecté », il garde ce choix et votre adresse électronique, pour préremplir la connexion. Elle y reste après la déconnexion, jusqu’à ce que vous décochiez la case.',
      demo: 'La démonstration garde ses données fictives dans le navigateur.',
    },
    rights: {
      title: 'Vos droits',
      body: 'Vous pouvez demander l’accès à vos données, leur rectification, leur effacement, leur portabilité ou la limitation de leur traitement, vous opposer à ce traitement, et définir des directives sur leur sort après votre décès. Écrivez à l’éditeur, par courrier ou par courriel, aux adresses ci-dessus.',
      complaint: 'Si la réponse ne vous satisfait pas, vous pouvez saisir la CNIL :',
      complaintLink: 'adresser une plainte à la CNIL',
    },
    home: 'Retour à l’accueil',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LES CONDITIONS GÉNÉRALES D'UTILISATION
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Elles disent le service TEL QU'IL EST — voir `src/legal/conditions.ts`, qui
  // porte les faits relevés et les choix assumés. Le mot « utilisation » et non
  // « vente » est un relevé, pas une préférence : rien dans le produit ne sait
  // facturer, et des conditions de vente décriraient un contrat que personne ne
  // peut conclure.
  terms: {
    title: 'Conditions générales d’utilisation',
    intro:
      'Ce que vous acceptez en utilisant GestLocPro, et ce que l’éditeur s’engage à faire. Ces conditions décrivent le service tel qu’il fonctionne aujourd’hui.',
    updatedOn: 'Rédigées le {date}',
    home: 'Retour à l’accueil',

    purpose: {
      title: 'Objet',
      body: 'Ces conditions régissent l’accès à GestLocPro et son utilisation. Elles s’appliquent dès la création d’un compte, à toute personne qui s’en sert — bailleur, gestionnaire ou locataire.',
      publisher: 'L’éditeur, son immatriculation et ses coordonnées figurent aux mentions légales.',
    },

    service: {
      title: 'Le service',
      body: 'GestLocPro est un outil de gestion locative accessible par navigateur. Il permet de tenir un parc de logements : baux, appels de loyer, quittances, relevés d’eau et d’électricité, états des lieux, interventions, et un portail par lequel un locataire consulte ce qui le concerne.',
      // Ce qu'un outil n'est pas se dit explicitement : un bailleur qui croirait
      // acheter du conseil fiscal ferait reposer une décision sur un calcul.
      notTitle: 'Ce que GestLocPro n’est pas',
      notAdvice:
        'Il ne donne ni conseil juridique, ni conseil fiscal, ni conseil comptable. Les documents qu’il produit — quittances, décomptes, états des lieux — sont des outils de suivi, et leur conformité à votre situation reste votre appréciation.',
      notFunds:
        'Il n’encaisse aucun loyer et ne détient aucun fonds. Les versements que vous y enregistrez sont des écritures de suivi ; l’argent circule hors du service.',
      notAccounting: 'Il ne se substitue pas à une comptabilité tenue par un professionnel.',
    },

    account: {
      title: 'Le compte',
      body: 'La création d’un compte suppose d’être majeur et capable de contracter. Les informations que vous fournissez doivent être exactes et tenues à jour : elles figurent sur les documents que le service produit.',
      password: 'Vous êtes responsable de la confidentialité de votre mot de passe et des actions menées depuis votre compte. Prévenez l’éditeur sans délai si vous soupçonnez qu’un tiers y accède.',
      invite: 'Un gestionnaire ou un locataire rejoint le parc d’un tiers par un code d’invitation, et le rôle vient de ce code. Nul ne peut se déclarer locataire d’un logement de son propre chef.',
    },

    price: {
      title: 'Prix',
      // LA PHRASE LA PLUS IMPORTANTE DE LA PAGE, et la plus susceptible de
      // vieillir : elle est vraie tant qu'aucune facturation n'existe.
      body: 'GestLocPro est fourni sans contrepartie financière à ce jour. Aucun moyen de paiement ne vous est demandé, et aucune facture n’est émise.',
      future: 'Si l’éditeur décide de rendre le service payant, il vous en informera au préalable et recueillera votre acceptation explicite. Sans cette acceptation, votre compte n’est ni facturé ni fermé d’office : vous conservez le droit d’exporter l’intégralité de vos données avant toute décision.',
    },

    data: {
      title: 'Vos données, et celles de vos locataires',
      // La distinction responsable / sous-traitant n'est pas une formalité : un
      // bailleur qui enregistre la fiche de son locataire collecte les données
      // personnelles d'un tiers, et c'est lui qui en répond.
      body: 'Les données que vous déposez vous appartiennent. L’éditeur ne les exploite pas à d’autres fins que le fonctionnement du service.',
      controller: 'Lorsque vous enregistrez les informations de vos locataires — identité, coordonnées, pièces, photographies —, vous en êtes le responsable de traitement. Il vous revient de les informer et de disposer d’une base légale pour les conserver. L’éditeur agit alors comme sous-traitant, pour votre compte et sur vos instructions.',
      privacy: 'Le détail des traitements, des destinataires et de vos droits figure à la politique de confidentialité.',
    },

    duties: {
      title: 'Vos obligations',
      body: 'En utilisant le service, vous vous engagez à :',
      lawful:
        'ne l’employer qu’à des fins licites, et dans le respect des droits des personnes dont vous enregistrez les données ;',
      scope: 'ne pas tenter d’accéder à des parcs ou à des logements qui ne vous ont pas été confiés ;',
      disrupt:
        'ne pas entraver son fonctionnement, ni en extraire massivement le contenu par des moyens automatisés ;',
      content: 'ne déposer aucun contenu illicite, et répondre de ce que vous y déposez.',
    },

    availability: {
      title: 'Disponibilité',
      // Aucun engagement n'est pris parce qu'aucun n'est mesuré. Promettre un
      // taux qu'on ne surveille pas serait une promesse sans instrument.
      body: 'L’éditeur met en œuvre les moyens raisonnables pour que le service soit accessible, sans s’engager sur un taux de disponibilité. Des interruptions sont possibles : maintenance, panne, défaillance d’un prestataire, ou force majeure.',
      backup: 'Des sauvegardes sont tenues par l’hébergeur. Elles ne dispensent pas d’exporter régulièrement vos données, ce que le service permet à tout moment.',
    },

    liability: {
      title: 'Responsabilité',
      body: 'L’éditeur répond des dommages directs et prévisibles causés par un manquement de sa part. Il ne répond pas des conséquences d’une information erronée que vous auriez saisie, d’un usage contraire à ces conditions, ni de la perte de données que vous n’auriez pas exportées alors que le service vous le permettait.',
      force: 'Aucune des parties ne répond d’un manquement causé par un événement échappant à son contrôle.',
    },

    property: {
      title: 'Propriété',
      body: 'Le service, son code, sa marque et son interface appartiennent à l’éditeur. Leur utilisation ne vous confère aucun droit sur eux. Vos données, elles, restent les vôtres : ni leur dépôt sur le service ni ces conditions n’en transfèrent la propriété.',
    },

    closure: {
      title: 'Durée, résiliation et effacement',
      body: 'Ces conditions s’appliquent tant que votre compte existe. Vous pouvez y mettre fin à tout moment, sans motif ni préavis, depuis votre espace.',
      // Les faits de cette rubrique sont RELEVÉS dans le code : un cas les garde
      // contre la source du serveur.
      delay: 'La fermeture est immédiate sur vos accès — vos sessions sont coupées — et l’effacement intervient {days} jours plus tard. Ce délai existe pour que vous puissiez revenir : une simple reconnexion pendant cette période annule la fermeture.',
      scope: 'L’effacement emporte votre compte et les parcs dont vous êtes le seul propriétaire, avec ce qu’ils contiennent. Un parc que vous partagez avec un autre propriétaire subsiste : il n’appartient pas qu’à vous.',
      warned: 'Les personnes que votre fermeture prive d’accès — gestionnaires et locataires du parc — en sont averties, dans leur langue, et prévenues de nouveau si vous l’annulez.',
      export: 'Avant de fermer, vous pouvez exporter l’intégralité de vos données en CSV et en PDF. Aucune durée de rétention ne vous est imposée.',
    },

    suspension: {
      title: 'Suspension',
      body: 'L’éditeur peut suspendre un accès en cas de manquement grave à ces conditions, notamment un usage illicite ou une tentative d’accès à des données qui ne vous sont pas confiées. Sauf urgence ou obligation légale, la suspension est précédée d’une information et vous laisse la possibilité d’exporter vos données.',
    },

    changes: {
      title: 'Modification de ces conditions',
      body: 'Ces conditions peuvent évoluer avec le service. Toute modification substantielle vous sera signalée avant de s’appliquer. Si elle ne vous convient pas, vous pouvez exporter vos données et fermer votre compte.',
    },

    law: {
      title: 'Droit applicable et différends',
      body: 'Ces conditions sont régies par le droit français.',
      amicable: 'En cas de différend, adressez-vous d’abord à l’éditeur : ses coordonnées figurent aux mentions légales. Une solution amiable reste la voie la plus rapide.',
      // LACUNE ASSUMÉE ET ÉCRITE : aucun médiateur n'est souscrit, et en
      // inventer un serait pire que de l'omettre. Voir `src/legal/conditions.ts`.
      court: 'À défaut d’accord, le litige relève des tribunaux compétents selon les règles de droit commun. Si vous êtes un consommateur, vous conservez le droit de saisir la juridiction du lieu où vous demeuriez à la conclusion du contrat ou de la survenance du fait dommageable.',
    },
  },
} as const
