/**
 * LA SECTION `app` DU DICTIONNAIRE FRANÇAIS — et elle vit à part parce qu'elle
 * ne part PAS sur le fil avec la page d'accueil.
 *
 * ═══ CE QUE CE FICHIER EXISTE POUR FAIRE ═══
 *
 * `fr.ts` est IMPATIENT : `I18nProvider` l'importe statiquement, donc tout
 * visiteur de la vitrine le télécharge, dans toutes les langues et à toute
 * adresse. Mesuré par `premier-chargement.mjs`, section par section : `app`
 * pesait à elle seule 20 223 o compressés, soit 13,6 % du premier chargement —
 * des mots d'écrans de gestion, pour quelqu'un qui lit une page de vente et ne
 * s'inscrira peut-être jamais.
 *
 * Ce fichier est chargé par la MÊME promesse que l'espace applicatif et que
 * l'annonce publique (voir `chargerDictionnaireApplicatif` dans
 * `I18nProvider.tsx`, et ses deux appelants dans `App.tsx`). Aucun écran ne peut
 * donc se rendre avant ses mots : c'est React qui le garantit, par le `Suspense`
 * de la frontière, et non une convention qu'on se rappellerait de tenir.
 *
 * ═══ LA FAUTE QUE CETTE SCISSION REND POSSIBLE, ET QUI LA GARDE ═══
 *
 * Un module du PAQUET D'ENTRÉE qui appelle `t('app.quelquechose')` s'exécute
 * avant que ce fichier n'existe : `t()` rendrait la clé brute à l'écran. Rien
 * dans le typage ne le dit — `MessageKey` reste dérivé du dictionnaire entier,
 * exprès, pour qu'un écran applicatif nomme ses clés normalement.
 *
 * `scripts/check-dictionnaire-impatient.mjs` est la garde qui ferme ce trou. Il
 * marche le graphe d'imports depuis `main.tsx`, s'arrête aux `import()`
 * dynamiques, et refuse toute citation de `app.*` de ce côté-ci de la frontière.
 * Il est né ROUGE sur cinq clés, qui ont été sorties de `app.` dans le même
 * lot : `app.crash.*` (l'écran de panne, monté au-dessus de tout) et
 * `app.dashboard.chartTitle` / `openMonth` (le graphe que la page d'accueil
 * montre autant que le tableau de bord). Elles vivent dans `common.crash` et
 * `common.chart`.
 *
 * ═══ POURQUOI LE BLOC EST IMBRIQUÉ SOUS `app` PLUTÔT QU'À PLAT ═══
 *
 * `export const frApp = { app: { … } }` garde le chemin des clés INCHANGÉ —
 * `app.portfolio.title` reste `app.portfolio.title` — et laisse la fusion
 * s'écrire `{ ...fr, ...frApp }`, sans renommer quoi que ce soit. Le bloc a été
 * déplacé au caractère près, sans ré-indentation : il porte 108 accents graves
 * dans ses commentaires, et une reprise d'indentation faite à la main sur trois
 * mille lignes est exactement le genre de geste qui abîme une chaîne sans que
 * personne ne le voie.
 */
export const frApp = {
  app: {
    period: 'Période',
    total: 'Total',
    /**
     * L'INTITULÉ DU PIED D'UN TABLEAU QUI SOMME — voir `DataTable.lignesEnTout`.
     *
     * « lignes » ET NON LE NOM DE L'OBJET, et c'est un arbitrage. Cinq écrans
     * portent ce pied — cautions, paiements, parc, locataires, relevés — et cinq
     * paires de clés auraient dit la même chose cinq fois, avec cinq accords à
     * tenir. Le nom de la collection est déjà écrit deux fois au-dessus : dans le
     * titre de la page, et dans la légende du tableau que les lecteurs d'écran
     * annoncent en y entrant. « ligne » est d'ailleurs le mot juste ici — c'est
     * de rangées de tableau qu'on parle, et c'est ce qu'on compte.
     */
    totalRows: 'Total · {count} lignes',
    totalRows_one: 'Total · {count} ligne',
    /* LA FORME FILTRÉE. Le dénominateur est ce qui empêche de lire le pied comme
       une contradiction de la carte d'indicateur du haut. */
    totalRowsOf: 'Total · {count} lignes sur {all}',
    totalRowsOf_one: 'Total · {count} ligne sur {all}',
    exportStatement: 'Exporter le relevé',
    recordPayment: 'Enregistrer un paiement',
    /**
     * Le message annonçait « (PDF + CSV) » et ne produisait aucun des deux.
     * Le PDF demanderait une dépendance de rendu entière ; le CSV, lui, est
     * réellement fabriqué — on n'annonce donc plus que lui, nom de fichier
     * compris, faute de quoi l'utilisateur cherche dans ses téléchargements
     * un fichier dont il ignore le nom.
     */
    exported: 'Relevé exporté en CSV · {file}',
    receiptDownloaded: 'Quittance téléchargée · {file}',

    /**
     * Segments de noms de fichiers.
     *
     * Ce sont des libellés vus par l'utilisateur, dans son dossier de
     * téléchargements : ils se traduisent comme le reste. `csvFilename` les
     * réduit à une forme sûre — accents, espaces et ponctuation compris.
     */
    files: {
      payments: 'paiements',
      portfolio: 'parc-immobilier',
      collections: 'encaissements',
      meters: 'releves-compteurs',
      receipt: 'quittance',
      deposits: 'etat-des-cautions',
      deposit: 'recu-caution',
      inspection: 'etat-des-lieux',
    },
    paymentSaved: 'Paiement enregistré · quittance envoyée',
    roleNotice: 'Vous consultez l’espace en tant que {role}. Changez de profil dans la barre latérale.',
    closureBanner:
      'Ce parc sera supprimé le {date}. Emportez vos documents avant cette date — depuis « Mes données », dans le menu de votre compte.',
    demoBanner:
      'Les montants s’affichent en {currency} sans conversion de change.',

    /**
     * MES DONNÉES — l'export de portabilité (RGPD, art. 20).
     *
     * Les NATURES portent le nom que l'écran montre et que le fichier prend ;
     * les EN-TÊTES des CSV, eux, gardent les noms du serveur — voir
     * `MesDonnees.tsx`, qui dit pourquoi.
     */
    data: {
      title: 'Mes données',
      subtitle: 'Emporter ce que le produit sait de vous.',
      /* LE PARC EST NOMMÉ. « ce parc » ne désignait rien sur un écran dont le
         sujet EST l'étendue de ce qu'un compte peut lire — et un compte qui
         tient deux parcs ne savait pas lequel il emportait. */
      body:
        'Votre dossier rassemble ce que votre compte ({email}) peut lire dans {parc}. ' +
        'Il se télécharge en tableur, nature par nature, et en récapitulatif à archiver.',
      bodyAnonyme:
        'Votre dossier rassemble ce que votre compte peut lire dans {parc}. ' +
        'Il se télécharge en tableur, nature par nature, et en récapitulatif à archiver.',
      prepare: 'Préparer mon export',
      preparing: 'Préparation…',
      ready: 'Dossier arrêté au {date}.',
      demo: 'La démonstration ne tient aucun dossier, et rien n’est produit ici. Connectez-vous à votre parc pour exporter vos données.',
      failed: 'Le dossier n’a pas pu être préparé. Réessayez dans un moment.',
      nature: 'Nature',
      rows: 'Lignes',
      file: 'Fichier',
      downloadCsv: 'Tableur',
      downloadPdf: 'Récapitulatif PDF',
      csvReady: 'Fichier {file} téléchargé',
      pdfTitle: 'Récapitulatif de mon export',
      pdfFor: 'Dossier de {name}',
      pdfOn: 'Arrêté le {date}',
      pdfIntro:
        'Ce récapitulatif dit ce que contient l’export et à quelle date il a été arrêté. Le détail de chaque nature se trouve dans les fichiers de tableur téléchargés avec lui.',
      pdfCounts: 'Lignes exportées, par nature',
      pdfFoot: 'Page {page} sur {total}',
      closeTitle: 'Fermer mon compte',
      closeBody:
        'Fermer votre compte demande l’effacement de tout ce que vous venez d’exporter — {lignes} lignes, ' +
        'vos documents et votre parc compris. L’effacement a lieu {jours} jours plus tard, et il est définitif.',
      closeUndo:
        'Pendant ces {jours} jours, vous reconnecter annule la demande. Vos sessions ouvertes, elles, sont coupées tout de suite.',
      closeUnderstood: 'J’ai exporté mes données et je comprends que tout sera effacé.',
      close: 'Fermer mon compte',
      closeFailed: 'La fermeture n’a pas pu être demandée. Réessayez dans un moment.',
      natures: {
        immeubles: 'Immeubles',
        logements: 'Logements',
        locataires: 'Fiches locataires',
        baux: 'Baux',
        loyersAppeles: 'Loyers appelés',
        versements: 'Versements',
        cautions: 'Cautions',
        releves: 'Relevés de compteurs',
        tarifs: 'Tarifs de refacturation',
        etatsDesLieux: 'États des lieux',
        travaux: 'Travaux et signalements',
        avis: 'Avis reçus',
        adhesions: 'Membres du parc',
        invitations: 'Invitations',
        journal: 'Registre des décisions',
      },
    },
    documents: {
      title: 'Mes pièces et quittances',
      subtitle: 'Votre dossier de bail et l’historique de vos quittances.',
      downloadAll: 'Tout télécharger',
      allReceipts: 'Quittances du locataire',
      request: 'Demander un document',
      /**
        * « …et dépose la pièce dans cet espace » : il ne dépose rien. Le
        * produit ne sait recevoir aucun fichier, et le gestionnaire ne fait
        * que répondre. La phrase datait d'avant l'entité de demande et ne
        * l'avait pas suivie.
        */
      requestHint: 'Le gestionnaire reçoit la demande et vous répond dans cet espace.',
      reqNoChoice: 'Choisissez la pièce à demander',
      requestSend: 'Envoyer la demande',
      requestSent: 'Demande envoyée au gestionnaire',
      reqResidence: 'Attestation de résidence',
      reqGoodStanding: 'Attestation de bon paiement',
      reqLeaseCopy: 'Duplicata de bail',
      /**
       * Où en est la demande.
       *
       * « Fournie » plutôt que « traitée » : le locataire veut savoir s'il peut
       * venir chercher sa pièce, pas si son dossier a avancé. Et « Non
       * disponible » plutôt que « Refusée » — le gestionnaire décline une pièce
       * qu'il ne peut pas produire, il ne rejette pas la personne.
       */
      reqStatus: {
        pending: 'Demandée',
        fulfilled: 'Fournie',
        declined: 'Non disponible',
      },
      /** Côté gestionnaire : ce qu'il a à traiter, et ses deux réponses. */
      myRequests: 'Mes demandes',
      pending: 'Demandes de documents',
      pendingHint: 'Vos locataires attendent ces pièces.',
      markFulfilled: 'Marquer fournie',
      markDeclined: 'Ne peut pas être fournie',
      resolvedToast: 'Réponse enregistrée · le locataire la voit dans son espace',
      requestedOn: 'Demandée le {date}',
      privacy: 'Confidentialité',
      privacyBody:
        'Vos pièces ne sont visibles que de vous et des gestionnaires de votre parc. Aucun autre locataire n’y accède.',
      contractual: 'Contractuel',
      contractualTitle: 'Mon dossier',
      receipts: 'Quittances',
      receiptsTitle: 'Mes quittances',
      lease: 'Contrat de bail signé',
      entryInspection: 'État des lieux d’entrée',
      depositReceipt: 'Reçu de caution',
      view: 'Consulter',
      download: 'Télécharger',
      downloadFor: 'Télécharger — {period}',
      /**
       * Le produit ne sait ni recevoir un fichier déposé, ni fabriquer un PDF
       * opposable. Annoncer « PDF » sur une case vide inventerait la pièce que
       * le bouton prétend restituer — le défaut que le portail a déjà payé.
       */
      none: 'Aucun document déposé',
      /* TROIS ABSENCES DE NATURES OPPOSÉES portaient la même formule creuse.
         Celle-ci ne viendra JAMAIS — le produit n'enregistre pas le texte d'un
         bail, et le fabriquer donnerait à une invention l'apparence d'une
         pièce. On dit donc ce qui existe à la place, dix centimètres plus bas
         sur le même écran. */
      leaseNever:
        'Le bail signé ne se dépose pas ici. Demandez un duplicata ci-dessous : votre gestionnaire vous répond dans cet espace.',
      /* Celui-là VIENDRA, et c'est toute la différence avec le précédent. */
      inspectionPending:
        'Il n’a pas encore été établi. Il apparaîtra ici dès la visite d’entrée.',
      pdfExitInspection: 'État des lieux de sortie',
      pdfIssuedOn: 'Émis le {date}',
      pdfBreakdown: 'Détail de la période',
      pdfRemaining: 'Reste à régler',
      pdfPayments: 'Versements reçus',
      pdfNoPayment: 'Aucun versement enregistré sur cette période.',
      csvConverted: 'Montants convertis du {from} vers le {currency}, au taux du {date} : {rate}.',
      csvConvertedPegged:
        'Montants convertis du {from} vers le {currency}, à la parité légale : {rate}.',
      pdfImputation:
        'Le versement a soldé le loyer à hauteur de {rent}, l’eau de {water} et l’électricité de {power}. L’imputation suit cet ordre.',
      pdfWithheldNote:
        'Le détail des retenues figure sur le décompte d’arbitrage remis par le propriétaire. Ce reçu en porte les montants, non les motifs.',
      pdfNoFinding: 'Aucune réserve.',
      pdfFindingsWithheld:
        '{count} réserves relevées. Leur détail n’est pas servi par le parc et ne figure donc pas ici.',
      pdfFindingsWithheld_one:
        'Une réserve relevée. Son détail n’est pas servi par le parc et ne figure donc pas ici.',
      pdfSigned: 'Signé',
      pdfNotSigned: 'Non signé',
      pdfFooter:
        '{park} · {document} · page {page} sur {total} · produit depuis les données enregistrées, sans signature',
      exportCsv: 'Exporter en tableur',
      depositsStatement: 'État des cautions',
      statementAsOf: 'Au {date}',
      statementWithheld: '{amount} retenus',
      exportDeposits: 'Exporter l’état des cautions',
      pdfDownloadDeposit: 'Télécharger le reçu de caution',
      pdfDownloadInspection: 'Télécharger l’état des lieux',
      pdfDownloaded: 'Document téléchargé · {file}',
    },

    tenant: {
      title: 'Mon espace locataire',
      subtitle: 'Votre logement, vos quittances et vos signalements.',
      noReceiptsTitle: 'Aucune quittance disponible',
      noReceiptsBody:
        'Votre historique de règlements n’est pas encore accessible depuis cet espace. Votre gestionnaire peut vous éditer une quittance sur demande.',
      noDocumentsBody:
        'Vos quittances apparaîtront ici dès que votre gestionnaire les aura émises.',
      // Les trois cartes de tête et le tableau par période — voir les maquettes.
      leaseSince: 'Bail en cours depuis le {date}',
      leaseManager: 'gestionnaire {name}',
      downloadReceipts: 'Télécharger mes quittances',
      reportIssue: 'Signaler une anomalie',
      rentFor: 'Loyer',
      water: 'Eau',
      power: 'Électricité',
      settled: 'Réglé',
      remaining: 'reste {amount}',
      paidOnBy: 'Payé le {date} par {method}',
      receipt: 'Quittance',
      byPeriod: 'Mes paiements par période',
      /**
       * `consumptionTrend` et non `consumption` : cette dernière EXISTE déjà —
       * « Ma consommation du mois », qu'affiche le portail vitrine. Réutiliser
       * la clé aurait changé un libellé sur un écran qu'on ne touche pas.
       */
      consumptionTrend: 'Ma consommation sur douze mois',
      average: 'moy. {value}',
      noReading: 'Relevé manquant',
      unitWater: 'm³',
      unitPower: 'kWh',
      colPeriod: 'Période',
      colRent: 'Loyer',
      colWater: 'Eau',
      colPower: 'Élec.',
      colReceipt: 'Quittance',
      legendSettled: 'Réglé',
      legendPartial: 'Partiel',
      myLease: 'Mon bail',
      worksSince: 'Depuis mon entrée le {date}',
      consumedWater: '{n} m³ consommés',
      consumedPower: '{n} kWh',
      noUnitTitle: 'Aucun logement rattaché à votre compte',
      noUnitBody: 'Votre compte appartient bien à ce parc, mais aucun bail n’y porte encore votre nom. Demandez à votre propriétaire ou à votre gestionnaire de relier votre fiche locataire à ce compte.',
      /* LA MOITIÉ DU PARCOURS QUI MANQUAIT. `noUnitBody` renvoie vers le
         bailleur, et c'est juste quand le locataire n'a rien en main. Quand le
         bailleur a fait ce que le produit lui montre — émettre un code portant
         le logement —, le locataire n'avait nulle part où le saisir. */
      linkTitle: 'Vous avez reçu un code pour votre logement ?',
      linkBody: 'Saisissez-le ici : votre bail, vos quittances et vos relevés apparaîtront aussitôt dans cet espace.',
      linkAction: 'Rattacher mon logement',
      linked: 'Logement rattaché · votre espace est à jour',
      /* LE LOGEMENT EXISTE, SA FICHE EST PRISE. On ne nomme pas l'autre compte :
         le locataire apprend que SON logement est pris, ce qui le concerne au
         premier chef ; par qui ne le regarde pas. */
      linkTaken:
        'Ce logement est déjà rattaché à un autre compte. Demandez à votre propriétaire de délier la fiche, puis réessayez ce code.',
      linkRefused: 'Ce code ne rattache aucun logement à votre compte. Demandez à votre propriétaire un code émis pour votre logement.',
      myReceipts: 'Mes quittances',
      myReceiptsHint: 'Émises par le serveur : les montants sont ceux du registre, pas ceux de l’écran.',
      leaseRent: 'Mon loyer mensuel',
      leaseRentNote: 'Montant fixé au bail, hors eau et électricité.',
      leaseDeposit: 'Ma caution versée',
      leaseDepositNote: 'Consignée jusqu’à l’état des lieux de sortie.',
      leaseDepositNone: 'Aucune caution enregistrée à votre nom.',
      myUnit: 'Mon logement',
      nextDue: 'Prochaine échéance',
      deposit: 'Caution consignée',
      consumption: 'Ma consommation du mois',
      lease: 'Mon bail',
      receipts: 'Mes quittances',
      receiptsEmpty: 'Aucune quittance pour le moment.',
      paidOn: 'Réglé le {date}',
      download: 'Télécharger',
      myWorks: 'Mes travaux en cours',
      worksEmpty: 'Aucune intervention en cours sur votre logement.',
      worksEmptyBody:
        'Dès que votre gestionnaire enregistre un signalement pour votre logement, l’intervention apparaît ici : vous en suivez le devis, sa validation, puis la fin des travaux.',
      alertsEmpty: 'Aucune notification vous concernant.',
      alertsEmptyBody:
        'Les rappels d’échéance, les relances de loyer et l’avancement des interventions de votre logement arrivent ici. Rien n’a encore été émis.',
      inspectionsEmpty: 'Aucun état des lieux enregistré pour votre logement.',
      inspectionsEmptyBody:
        'L’état des lieux d’entrée est établi à la remise des clés, celui de sortie à leur restitution. Votre gestionnaire les dépose ici pour que vous puissiez comparer les deux.',
      manager: 'Votre gestionnaire',
      managerName: 'Diane F.',
      /* LA FIN D'ACCÈS. « Warn », pas « danger » : une échéance, pas une panne.
         La phrase dit le geste — télécharger — parce qu'une date sans geste
         laisse compter les jours au lieu d'agir. */
      accessEnds: 'Votre bail est terminé : cet espace reste ouvert jusqu’au {date}. Téléchargez vos quittances avant cette date — ensuite, demandez-les à votre bailleur.',
      privacyNote:
        'Vous ne voyez que les données de votre logement. Les autres locataires du parc ne vous sont pas visibles.',
      restrictedTitle: 'Accès restreint',
      restricted: 'Cet écran n’est pas accessible avec le profil locataire.',
      restrictedHint: 'Revenez à votre espace pour consulter vos propres données.',
      backToSpace: 'Retour à mon espace',
    },

    dashboard: {
      /* SA VUE EST BORNÉE. Le FAIT, jamais son étendue : ni « 2 sur 3 », ni le
         nom de ce qui est caché — le périmètre strict a été décidé ainsi. La
         phrase dit ce qu'il faut pour ne pas lire ces chiffres comme ceux du
         parc entier, et rien de plus. */
      scopedNotice: 'Vous ne gérez qu’une partie de ce parc. Les chiffres de cet écran ne portent que sur les immeubles qui vous ont été confiés.',
      /* RIEN, ET NON « UNE PARTIE ». Zéro immeuble confié n'est pas une
         partie : la phrase d'à côté devenait fausse sur l'état de NAISSANCE
         de tout gestionnaire. Elle énonce, elle ne prescrit pas — « demandez
         au propriétaire » serait une consigne, et aucun écran ne porte ce
         geste. Elle ne dit rien du parc non plus : c'est un fait sur SON
         périmètre, qu'il constate déjà en regardant des écrans vides. */
      scopedNoticeNothing: 'Rien ne vous a encore été confié dans ce parc. Ces écrans resteront vides tant qu’aucun immeuble ne vous sera confié.',
      titleOwner: 'Vue consolidée du parc',
      titleManager: 'Ma journée de gestion',
      titleTenant: 'Mon espace locataire',
      subtitle: '{buildings}, {units} · montants en {currency}',
      chartEmptyTitle: 'Aucun encaissement pour l’instant',
      chartEmptyBody:
        'La courbe des douze mois se remplira dès votre premier paiement enregistré.',
      expected: 'Loyers attendus',
      collected: 'Encaissé ce mois',
      /**
       * LA BASE DE LA VARIATION, NOMMÉE.
       *
       * Une pastille « −16,8 % » sans son point de départ est un pourcentage
       * flottant : on ne peut ni le vérifier, ni le retrouver dans le graphique
       * qui vit trois cents pixels plus bas. La ligne dit à quoi la carte se
       * compare, et c'est ce qui la rend lisible.
       */
      vsPrevious: 'vs. {amount} au même jour le mois dernier',
      /**
       * « Impayés cumulés » disait deux choses fausses.
       *
       * Rien n'est CUMULÉ : c'est le reste de l'appel de loyers courant, calculé
       * sur l'instantané des unités, exactement comme « encaissé ce mois » à
       * côté. Le mot laissait croire à un arriéré qui grossit de mois en mois.
       *
       * Et tout n'est pas IMPAYÉ au sens de « en retard » : le montant réunit
       * les règlements partiels et les retards, que la carte de recouvrement
       * distingue justement en deux lignes. Nommer l'ensemble par sa moitié la
       * plus sévère durcit la lecture d'un parc qui se porte mieux qu'il n'y
       * paraît.
       *
       * « Reste à percevoir » dit ce que le nombre est : ce qui manque à
       * l'appel, sans préjuger de la raison ni de l'ancienneté.
       */
      outstanding: 'Reste à percevoir',
      /* RIEN N'EST ATTENDU — voir `Dashboard` : sans bail actif, « 100 % du
         loyer attendu » annonçait un arriéré total sous un reste de zéro. */
      nothingExpected: 'Aucun loyer attendu ce mois-ci.',
      outstandingShare: '{percent} % du loyer attendu',
      queueTitle: 'À traiter',
      queueCount: '{count} en attente',
      queueCount_one: '{count} en attente',
      queueEmptyTitle: 'Rien n’attend de vous',
      queueEmptyBody:
        'Aucun loyer en retard, aucun arbitrage en suspens, aucun relevé manquant. Cette liste se remplit d’elle-même dès qu’une échéance passe ou qu’un devis arrive.',
      queueOverdueTitle: '{count} loyers ne sont pas soldés',
      queueOverdueTitle_one: '{count} loyer n’est pas soldé',
      queueOverdueDetail: '{amount} à percevoir · jusqu’à {days} jours de retard',
      queueOverdueAction: 'Encaisser',
      queueDepositsTitle: '{count} cautions attendent votre arbitrage',
      queueDepositsTitle_one: '{count} caution attend votre arbitrage',
      queueDepositsDetail: '{amount} retenus · {units}',
      queueDepositsAction: 'Arbitrer',
      /* LE SIGNALEMENT QUI ATTEND UN CHIFFRAGE. Il n'atteignait pas l'écran
         d'arrivée du bailleur, qui ne le voyait donc jamais en se connectant. */
      queueReportsTitle: '{count} signalements attendent un chiffrage',
      queueReportsTitle_one: '{count} signalement attend un chiffrage',
      queueReportsDetail: 'Déclarés par vos locataires · {units}',
      queueReportsAction: 'Chiffrer',
      queueQuotesTitle: '{count} devis attendent votre accord',
      queueQuotesTitle_one: '{count} devis attend votre accord',
      queueQuotesDetail: '{amount} engagés si vous validez · {units}',
      queueQuotesAction: 'Décider',
      queueReadingsTitle: '{count} relevés manquent pour facturer le mois',
      queueReadingsTitle_one: '{count} relevé manque pour facturer le mois',
      queueReadingsDetail: 'La refacturation reste incomplète tant qu’ils ne sont pas saisis · {units}',
      queueReadingsAction: 'Saisir',
      occupancy: 'Taux d’occupation',
      // « vs mois précédent » accompagnait un écart mensuel qui a disparu :
      // il supposait un historique que le produit n'a pas, et l'indicateur
      // n'aurait jamais varié. La mention le suit, sans quoi elle renvoie à un
      // chiffre absent.
      activeLeases: '{count} baux actifs',
      activeLeases_one: '{count} bail actif',
      collectedShare: '{percent} % du dû',
      // Le compte porte sur TOUS les locataires qui doivent encore quelque
      // chose — partiels compris —, puisque c'est ce que totalise le montant
      // au-dessus. Il ne retenait que les retards : quatre locataires devaient,
      // la note en annonçait trois.
      overdueTenants: '{count} locataires · jusqu’à {days} jours de retard',
      overdueTenants_one: '{count} locataire · jusqu’à {days} jours',
      vacantUnits: '{count} unités vacantes',
      vacantUnits_one: '{count} unité vacante',
      /* LE COMPTE VIENT DE LA DONNÉE, et il ne le faisait pas. « 12 mois » était
         écrit en dur au-dessus d'un graphe qui ne rend que les périodes PORTANT
         une échéance : un parc ouvert en août en montrait deux sous un titre qui
         en promettait douze. */
      chartTableCaption:
        'Chiffres mensuels derrière le graphique, ventilés en loyer, eau et électricité.',
      chartNote:
        'Montants encaissés par mois, ventilés entre loyer, eau et électricité. Le mois en cours est encore ouvert.',
      /* L'ANNEAU ET LES BARRES DU RECOUVREMENT, QUAND IL N'Y A RIEN — voir
         `Dashboard` : le cercle se peignait vide et les barres rapportaient une
         part à zéro relevé. Deux vides, deux causes, deux phrases. */
      recoveryEmptyTitle: 'Rien à recouvrer ce mois-ci',
      recoveryEmptyBody:
        'Aucun bail n’est actif : dès qu’un logement est loué, le loyer attendu et sa part encaissée s’affichent ici.',
      rebilledNoReading: 'Aucun relevé pris sur la période.',
      recoveryTitle: 'Recouvrement du mois',
      recoveryTableCaption: 'Montants derrière le graphique, ventilés par statut de règlement.',
      recoveryCollected: 'Payé',
      recoveryPartial: 'Partiel',
      recoveryLate: 'En retard',
      rebilled: 'Charges refacturées',
      /* LE DÉNOMINATEUR D'UNE PART. « 80 % » se lit aussi bien comme 80 % d'un
         montant ; la phrase dit ce qu'il divise, dans la forme que la carte
         « Total refacturé » emploie déjà sur le même écran. */
      rebilledOf: '{done} sur {total} relevés',
      decisionsTitle: 'Ce qui demande une décision',
      decisionDeposit: 'Caution à arbitrer · {tenant}',
      decisionsEmpty: 'Rien à arbitrer pour le moment.',
      scheduleTitle: 'Échéancier',
      scheduleEmptyTitle: 'Aucune échéance en attente',
      scheduleEmptyBody:
        'Tous les loyers appelés ont été encaissés. Cette liste se remplit d’elle-même dès qu’une échéance passe la date d’exigibilité.',
      breakdownTitle: 'Répartition du parc',
      /* DEUX TITRES POUR UNE CARTE, parce que deux rôles n'y lisent pas la même
         chose. Le propriétaire y voit l'impayé par immeuble, classé : le titre
         doit dire ce que la colonne de chiffres EST, faute de quoi un montant nu
         se lit au choix comme un loyer ou comme un reste. Le gestionnaire
         délégué n'en voit pas l'argent — il garde donc le titre d'occupation,
         qui décrit ce qu'il a sous les yeux. */
      breakdownTitleMoney: 'Impayé par immeuble',
      breakdownOutstanding: 'impayé',
      legendRent: 'Loyer',
      legendWater: 'Eau',
      legendPower: 'Électricité',
    },

    unitFile: {
      /**
       * Le dossier d'un logement — ce que cinq écrans savaient chacun de leur
       * côté, réuni autour d'une seule unité.
       */
      back: 'Retour au parc',
      /**
       * LES TROIS CHIFFRES QUE LE DOSSIER CALCULAIT SANS LES DIRE.
       *
       * Le reste dû se calculait PAR LIGNE dans la carte des périodes — « reste
       * 5 058 FCFA » — et n'était jamais totalisé. Le montant des travaux se
       * calculait par ligne et n'était jamais sommé. La caution était affichée
       * en petit, dans une liste de pièces. Trois nombres qui disent l'état d'un
       * logement, dispersés.
       */
      kpiBalance: 'Reste dû',
      kpiBalanceNote: 'sur {count} périodes facturées',
      kpiBalanceNote_one: 'sur {count} période facturée',
      kpiDeposit: 'Caution consignée',
      /* UNE NOTE PAR ÉTAT DE CAUTION. La note unique affirmait « à restituer en
         fin de bail » sous une caution déjà rendue — voir le bloc qui la rend
         dans `UnitFile.tsx`. Les trois états du modèle, les trois phrases. */
      kpiDepositNote_held: 'à restituer en fin de bail',
      kpiDepositNote_settling: 'en cours d’arbitrage',
      kpiDepositNote_returned: 'déjà restituée au locataire',
      kpiDepositNone: 'aucune caution enregistrée',
      kpiWorks: 'Travaux engagés',
      kpiWorksNote: 'sur {count} interventions',
      kpiWorksNote_one: 'sur {count} intervention',
      open: 'Ouvrir le dossier du logement {unit}',
      loadingTitle: 'Dossier du logement',
      notFoundTitle: 'Ce logement est introuvable',
      notFoundBody: 'Il a peut-être été retiré du parc, ou l’adresse est incomplète.',
      occupancy: 'Occupation',
      occupancyHint: 'Les baux successifs de ce logement, le plus récent d’abord.',
      occupancyEmpty: 'Aucun bail enregistré',
      occupancyEmptyBody:
        'Ce logement n’a pas encore d’historique d’occupation. Il apparaîtra dès qu’un bail y sera rattaché.',
      since: 'depuis le {date}',
      between: 'du {start} au {end}',
      billing: 'Périodes facturées',
      billingHint: 'Ce que le logement a appelé, et ce qu’il reste à recouvrer.',
      /* LE TOTAL et non le reste : « 9 périodes » se vérifie contre l'indicateur
         du haut, « 3 de plus » ne se vérifie contre rien. */
      billingAll: 'Voir les {count} périodes',
      /* INATTEIGNABLE PAR CONSTRUCTION — la commande ne paraît qu'au-delà de six
         périodes. Elle existe parce que la parité des dictionnaires l'exige de
         toute clé qui interpole `{count}`, et la règle a raison de ne pas faire
         d'exception : c'est en en accordant une qu'on laisse passer la clé qui,
         elle, sera vue au singulier. */
      billingAll_one: 'Voir la période',
      /* LE MOIS DANS LE NOM : six boutons identiques ne disent pas lequel on
         active — la règle que les douze « Modifier » des relevés ont écrite. */
      receiptFor: 'Quittance de {period}',
      /* L'UNITÉ COLLÉE AU NOMBRE FORMATÉ. Écrites à la main, ces deux-là
         rendaient « 1234 m³ » et « 1200 m² » — le défaut que `lib/numbers`
         existe pour fermer, invisible sous quatre chiffres. */
      waterVolume: '{volume} m³',
      surface: '{surface} m²',
      billingEmptyBody: 'Aucune échéance n’a encore été émise pour ce logement.',
      works: 'Travaux du logement',
      worksHint: 'Toutes les interventions, quelle que soit l’occupation.',
      worksEmpty: 'Aucune intervention',
      worksEmptyBody: 'Rien n’a été signalé ni planifié sur ce logement.',
      file: 'Pièces du dossier',
      waterUse: 'Consommation d’eau du mois',
      noDeposit: 'Aucune caution versée',
      noInspection: 'Non réalisé',
      noReading: 'Relevé manquant',
      fileHint: 'Caution, états des lieux et dernier relevé.',
    },

    portfolio: {
      unitType: 'Typologie',
      addUnitTitle: 'Ajouter un logement',
      addUnitTo: 'Ajouter un logement à {name}',
      addUnitDescription:
        'Le logement est créé vacant : vous y rattacherez un locataire ensuite, depuis l’écran Locataires.',
      unitBuilding: 'Immeuble',
      unitLabel: 'Numéro du logement',
      unitLabelPlaceholder: 'A1',
      unitLabelRequired: 'Requis',
      unitLabelTaken: 'Ce numéro existe déjà dans cet immeuble',
      /* CE QUI EST DÉJÀ PRIS, AVANT DE TAPER — voir `AddUnitModal` : on ajoute
         rarement un logement seul, et le doublon ne se disait qu'au refus. */
      unitLabelTakenHint: 'Déjà pris dans cet immeuble : {labels}.',
      unitSurface: 'Surface (m²)',
      /* LA DEVISE EST DANS LE LIBELLÉ, et ce n'est pas un ornement : la saisie
         est lue dans la devise AFFICHÉE puis reconvertie vers celle du parc
         (`parseAmount`). Écran réglé sur l'euro, « 145 000 » tapé vaut cent
         quarante-cinq mille euros, donc des milliards de francs — et rien, ni
         avant ni après, ne nommait l'unité. « Surface (m²) » porte la sienne
         depuis toujours. */
      unitRent: 'Loyer mensuel ({devise})',
      unitNumberInvalid: 'Nombre attendu',
      noBuildingYet: 'Déclarez d’abord un immeuble : un logement s’y rattache.',
      addBuildingTitle: 'Ajouter un immeuble',
      addBuildingDescription:
        'Le nombre de logements et le taux d’occupation se calculent ensuite, à mesure que vous ajoutez des logements.',
      buildingName: 'Nom de l’immeuble',
      buildingNamePlaceholder: 'Résidence Makepe',
      buildingNameInvalid: 'Au moins 2 caractères',
      district: 'Quartier',
      districtPlaceholder: 'Makepe',
      districtInvalid: 'Au moins 2 caractères',
      title: 'Parc immobilier',
      /**
       * Le sous-titre récitait « Trois immeubles, douze unités » — les chiffres
       * du jeu de DÉMONSTRATION, écrits en dur, servis à tout parc réel. Un
       * compte neuf ouvrait donc « Parc immobilier » sur une phrase qui lui
       * annonçait douze logements qu'il n'a pas.
       */
      subtitle: '{buildings}, {units}. Le statut porte sur le mois affiché.',
      /**
       * QUAND LE MOIS AFFICHÉ NE PORTE QU'UNE PART DU PARC, LE COMPTE LE DIT.
       *
       * Le sous-titre comptait `units` — le parc d'aujourd'hui — tandis que tout
       * l'écran rend `unitesAffichees`, borné au mois consulté. Un mois vide
       * faisait donc annoncer « 3 unités » au-dessus de trois en-têtes disant
       * « aucun logement ». Pourquoi la capture de production du 2026-10-07 qui
       * porte cette forme ne vient PAS de ce chemin : voir `Portfolio.tsx`, où
       * `compteDesLogements` le détaille.
       *
       * DEUX CLÉS ET NON UNE, parce que zéro est un ÉNONCÉ, pas une valeur :
       * `Intl.PluralRules` range 0 sous `one` en français et sous `other` en
       * anglais, si bien qu'aucune variante `_zero` ne serait jamais choisie — et
       * « dont 0 sur ce mois » n'est pas ce qu'on dit. Le dépôt sépare déjà le
       * rien du peu de cette façon, deux lignes plus bas, avec `buildingEmpty`.
       *
       * `{total}` EST DU TEXTE DÉJÀ ACCORDÉ, pas un nombre : il porte
       * « 3 unités » ou « 1 unité », que `common.unitCount` sait fléchir. Passer
       * le nombre ici demanderait de refaire l'accord dans ces deux chaînes.
       */
      unitsOnMonth: '{total}, dont {shown} sur ce mois',
      unitsNoneOnMonth: '{total}, aucune sur ce mois',
      // Aucun logement du tout : ce n'est pas une recherche infructueuse.
      buildingEmpty: 'aucun logement',
      /* Le nom du DÉCLENCHEUR du menu : trois points ne se prononcent pas, et
         « Actions » seul ne dirait pas de quelle ligne. */
      buildingActions: 'Actions de l’immeuble {name}',
      /* CE QUE LE NOMBRE VAUT, quand il ne vaut pas ce qu'on croit. Sur un lot
         vacant, la colonne « Loyer » affichait le même montant que sur un lot
         loué : il se lisait comme un revenu, alors que c'est un manque à gagner. */
      rentExpected: 'attendu',
      /* LA DURÉE DU RETARD, à côté de l'état. « En retard » est vrai à trois
         jours comme à vingt-quatre, et ce n'est pas la même décision. La donnée
         était déjà sur la ligne — `overdueDays` — et la pastille la jetait. */
      overdueFor: '{days} j',
      /* CE QUE L'IMMEUBLE PÈSE, à côté de ce qu'il remplit. Un écran de
         propriétaire portait l'occupation sans jamais porter l'argent. */
      buildingRent: '{amount} / mois',
      /* LE TOTAL DU PARC A SON PROPRE NOM, parce qu'il ne compte pas la même
         chose que son homonyme. `app.dashboard.expected` — « Loyers attendus » —
         coiffe sur le tableau de bord et les paiements ce que les BAUX appellent
         ce mois-ci ; ici le chiffre couvre tous les lots, vides compris. Deux
         nombres sous un seul mot est la confusion que `indicateursEnDouble`
         traque dans l'autre sens.

         ÉCRIT, RETIRÉ, PUIS RENDU — et le détour mérite d'être dit. Il a été
         retiré parce qu'il ne restait que huit octets au budget du premier
         chargement, et que ce dictionnaire partait alors avec la page d'accueil.
         La scission l'a sorti de là : ces octets-ci ne sont plus payés par
         personne qui ne les lise. Une contrainte de poids avait fait perdre un
         mot juste ; elle a cessé d'exister, le mot revient. */
      kpiRent: 'Loyer du parc',
      /* L'ÉCART ENTRE LE PARC PLEIN ET CE QUI RENTRE, dans la note du total :
         c'est lui que la vacance creuse, et il n'était écrit nulle part.

         SANS LE COMPTE DES BAUX — et le motif a changé sous cette clé. Écrite,
         elle disait que la forme longue, avec ses deux pluriels, poussait le
         premier chargement de la vitrine à 160 019 o pour un budget de 160 000.
         C'ÉTAIT VRAI, ET CE NE L'EST PLUS : depuis la scission du dictionnaire,
         cette section ne part plus avec la page d'accueil, et cette clé ne lui
         coûte RIEN. Ce qui reste est la seule raison qui tienne encore : la
         carte voisine dit déjà « 2/7 occupées », et le compte des baux y serait
         une troisième fois le même fait. La forme longue redeviendrait gratuite
         le jour où quelqu'un la jugerait meilleure. */
      kpiRentNote: '{amount} appelés',
      monthShown: 'Mois affiché',
      previousMonth: 'Mois précédent',
      nextMonth: 'Mois suivant',
      /* LE MOTIF DANS LE NOM, comme pour les deux suppressions du Parc : un
         geste fermé sans raison se cherche, puis se prend pour une faute. */
      monthLockedInDemo: 'Changer de mois — la démonstration ne porte qu’un mois',
      noFutureMonth: 'Mois suivant — rien n’est appelé au-delà du mois en cours',
      unitActions: 'Actions du logement {unit}',
      /* LES DEUX FLÈCHES DU RAIL — voir `RailDeLogements`. Elles sont
         `aria-hidden` : c'est un raccourci de pointeur, le clavier atteignant
         déjà chaque fiche. Le nom reste, pour le survol et pour la garde des
         noms accessibles. */
      railPrevious: 'Voir les logements précédents',
      railNext: 'Voir les logements suivants',
      remove: 'Retirer',
      deleteUnit: 'Retirer le logement {unit}',
      /* MÊME FORME QUE POUR L'IMMEUBLE : l'ÉTAT d'abord, le geste ensuite. Un
         nom accessible qui commence par « Retirer le logement… » sur un bouton
         fermé porte le même préfixe que le geste ouvert — `modales` sélectionne
         par ce préfixe, et cliquerait le mauvais. */
      deleteUnitBlocked: 'Retrait impossible — {unit} a une histoire dans le parc',
      /* LE MÊME FAIT, RENDU À L'ŒIL. `deleteUnitBlocked` est le nom accessible
         — il porte le numéro parce que douze entrées se ressemblent ; celle-ci
         se lit SOUS le libellé, dans un menu déjà ouvert sur sa fiche, où le
         numéro serait redit pour rien. */
      /* L'ALTERNATIVE AU GLISSEMENT, exigée par WCAG 2.5.7 : un geste de
         glissement doit être obtenable à un seul pointeur. Le menu de la fiche
         les porte, ce qui sert le clavier par la même porte. */
      /* LE LIBELLÉ DE L'AXE, et les deux sens ne servent plus que de noms
         accessibles : la rangée dit « Déplacer » une fois, deux flèches portent
         les directions. */
      moveUnit: 'Déplacer',
      moveUnitLeft: 'Déplacer à gauche',
      moveUnitRight: 'Déplacer à droite',
      /* ELLE DIT LA POSITION, PAS LE GESTE. « Déplacé » ne renseigne sur rien :
         c'est le rang atteint qui est la seule chose qu'on ne peut pas voir quand
         on ne voit pas le rail. Le total y est parce qu'un rang sans son total ne
         dit pas qu'on est arrivé au bout. */
      unitMoved: '{unit} — position {rang} sur {total}',
      /* RACCOURCIE À UNE LIGNE, et non supprimée. Elle tenait treize mots sur
         TROIS lignes dans le menu : l'entrée désactivée y était le bloc le plus
         lourd, donc l'élément qu'on ne peut pas cliquer dominait ceux qu'on
         peut. La décision qui l'a créée tient toujours — « “Retirer” en gris,
         sans un mot, se clique deux fois avant qu'on renonce » —, et
         l'explication complète vit dans la fenêtre de confirmation. Un menu est
         un endroit où l'on choisit, pas où l'on lit. */
      deleteUnitReason: 'Des paiements ou un bail y sont rattachés.',
      deleteUnitTitle: 'Retirer {unit} ?',
      deleteUnitBody:
        'Ce logement n’a jamais porté de bail, de relevé ni de travaux. Le retrait est définitif.',
      deleteUnitDone: 'Logement retiré',
      deleteBuilding: 'Supprimer l’immeuble {name}',
      /* POURQUOI LE GESTE EST FERMÉ, et non le geste absent. Le bouton
         n'apparaissait que sur un immeuble VIDE : sur tous les autres il n'y
         avait rien — ni bouton, ni raison, et deux immeubles côte à côte
         offraient des gestes différents sans que rien ne le dise. Le libellé
         porte le COMPTE, parce que c'est lui qui dit quoi faire pour débloquer. */
      /* L'ÉTAT D'ABORD, ET LE NOM ENSUITE — ce n'est pas une préférence de
         style. Commencé par « Supprimer l'immeuble … », le geste FERMÉ portait
         le même début que le geste OUVERT : `modales` sélectionne la commande
         par ce préfixe, et cliquait un bouton fermé en croyant ouvrir la modale
         de suppression, qu'elle a cessé d'atteindre — « le bouton a été cliqué
         et aucune boîte de dialogue n'est apparue », quatre fois.
         Une synthèse vocale y gagne aussi : elle annonce l'impossibilité avant
         de promettre l'action. */
      deleteBuildingBlocked:
        'Suppression impossible — {name} porte {count} logements',
      deleteBuildingBlocked_one: 'Suppression impossible — {name} porte {count} logement',
      deleteBuildingTitle: 'Supprimer {name} ?',
      deleteBuildingBody:
        'Cet immeuble ne porte aucun logement. La suppression est définitive.',
      deleteBuildingDone: 'Immeuble supprimé',
      /* CORRIGER, ET NON MODIFIER. Le geste répare une saisie ; « modifier »
         laisserait croire qu'un immeuble change de nature. */
      editBuilding: 'Corriger l’immeuble {name}',
      editBuildingTitle: 'Corriger {name}',
      editBuildingBody:
        'Le nom et le quartier seuls. Aucun bail, aucun logement, aucune somme n’en dépend.',
      editBuildingDone: 'Immeuble corrigé',
      editUnit: 'Corriger le logement {unit}',
      editUnitTitle: 'Corriger le logement {unit}',
      editUnitBody: 'Numéro, typologie, surface et loyer de référence.',
      editUnitDone: 'Logement corrigé',
      /* ELLE NE PARAÎT QUE SUR UN LOGEMENT OCCUPÉ — voir `EditUnitModal`. Le
         serveur ne fait PAS redescendre ce loyer dans le bail ni dans les
         échéances déjà appelées, et sans cette phrase la correction aurait
         l'air de n'avoir servi à rien. */
      editUnitRentNote:
        'Le loyer du bail en cours et les échéances déjà appelées ne changent pas : ce montant sert aux prochains baux.',
      emptyTitle: 'Aucun logement pour l’instant',
      emptyBody: 'Déclarez un immeuble, puis ajoutez-y vos logements.',
      /* L'ÉTAT VIDE D'UN GESTIONNAIRE NON SERVI. Le générique lui disait de
         DÉCLARER un immeuble — sur un parc qui en compte trois, et avec le
         bouton à portée : le produit l'invitait à dédoubler le parc de son
         client. */
      emptyScopedTitle: 'Rien ne vous a encore été confié',
      emptyScopedBody: 'Ce parc ne vous montrera des logements qu’une fois qu’un immeuble vous aura été confié.',
      unit: 'Unité',
      building: 'Immeuble',
      type: 'Type',
      surface: 'Surface',
      rent: 'Loyer',
      tenant: 'Locataire',
      status: 'Statut',
      /* DEUX COLONNES LÀ OÙ IL N'Y EN AVAIT QU'UNE — voir
         `etatSepareDeLOccupation`. « Ce mois » comptait ensemble ce qu'un bail a
         réglé et le fait qu'il n'y ait pas de bail ; l'occupation est une nature
         d'état à part, et le tiret de `nothingDue` dit qu'un logement vacant n'a
         rien à devoir plutôt que de le peindre en défaut. */
      occupation: 'Occupation',
      occupied: 'Occupé',
      /* Lu par les seuls lecteurs d'écran : un tiret cadratin s'annonce « tiret »
         ou ne s'annonce pas du tout, et douze cellules muettes ne diraient pas
         POURQUOI elles le sont. */
      nothingDue: 'Rien à percevoir',
      noTenant: 'Aucun locataire',
      /* Le geste d'une fiche VACANTE, sur la carte même : la modale est celle
         des Locataires, ouverte sur ce logement seul. */
      assignTenant: 'Attribuer un locataire',
      /* Ce que la fiche dit en plus, seulement quand c'est vrai. */
      sinceLease: 'depuis {date}',
      /* LA NOTE DE LA RANGÉE DU PARC, et pourquoi elle ne réemploie pas celle
         des travaux : « {count} encore à chiffrer » y compte des chantiers SANS
         DEVIS, ce qui est le geste de cet écran-là. Ici le total coiffe des
         fiches de LOGEMENT, et ce qu'il faut savoir est combien d'entre elles
         sont concernées — trois chantiers sur un même logement ne se lisent pas
         comme trois logements en travaux. */
      kpiWorksNote: '{count} logements concernés',
      kpiWorksNote_one: '{count} logement concerné',
      openWorks: '{count} chantiers en cours',
      openWorks_one: '{count} chantier en cours',
      depositHeld: 'Caution {amount}',
      paidOfRent: '{paid} reçus sur {rent}',
      legendPosts: 'Sur chaque fiche : loyer · eau · électricité',
      posts: 'Postes du mois',
      exportPark: 'Exporter le parc',
      occupancy: '{occupied}/{total} occupées',
      filterAll: 'Toutes',
      /* « LA RECHERCHE » ET NON « LES FILTRES » : le filtre par immeuble est
         parti avec ses pastilles, le groupement le rend sans objet. Le bouton
         n'efface plus qu'une chose, il le dit. */
      resetFilters: 'Effacer la recherche',
      searchEmpty: 'Aucune unité ne correspond à « {query} ».',
      searchEmptyHint: 'Essayez un numéro d’unité, un nom de locataire ou un quartier.',
    },

    /**
     * Typologie du logement. La notation française compte les pièces
     * principales ; l'anglais compte les chambres — voir `en.ts`.
     */
    unitTypes: {
      T1: 'T1',
      T2: 'T2',
      T3: 'T3',
      T4: 'T4',
    },

    receipts: {
      title: 'Document',
      description: 'Émis par le serveur : les montants sont ceux du registre, pas ceux de l’écran.',
      descriptionDemo:
        'Établi depuis le jeu de démonstration : ces montants sont fictifs, et aucun registre n’est tenu.',
      quittance: 'Quittance de loyer',
      recu: 'Reçu de paiement',
      tenant: 'Locataire',
      unit: 'Logement',
      due: 'Montant dû',
      /* LA PIÈCE NE JUGE PAS. Elle disait `status.pending` — devenu « À échoir »,
         qui parle de gestion et daterait faux sur un mois passé. Son en-tête le
         posait déjà : « une pièce atteste de ce qui a été reçu, pas de la
         diligence de qui devait payer ». */
      unsettled: 'Non réglé',
      paid: 'Montant reçu',
      balance: 'Solde',
      credit: '{amount} d’avance',
      payments: 'Versements',
      print: 'Imprimer',
      noCharge: 'Aucune échéance pour cette période : il n’y a rien à attester.',
      /* LE REFUS D'UNE PIÈCE SANS ARGENT, et il dit où aller. Le serveur rend
         422 `nothing_received` : sans ce texte, l'écran affichait « l'action a
         échoué », ce qui laisse chercher une panne là où il y a une règle. */
      nothingReceived: 'Rien n’a encore été reçu pour cette période : il n’y a pas de paiement à attester. Enregistrez le versement, ou relancez le locataire depuis les paiements.',
      /* LA PREUVE D'UN VERSEMENT — la capture du transfert mobile, ou le reçu
         scanné. Sur les marchés visés c'est la pièce réellement échangée : la
         référence de l'opérateur se recopie à la main depuis une image qui, elle,
         circule ailleurs. */
      attachProof: 'Joindre une preuve',
      viewProof: 'Voir la preuve',
      removeProof: 'Retirer la preuve',
      proofAttached: 'Preuve jointe',
      proofRemoved: 'Preuve retirée',
      proofFailed: 'La preuve n’a pas pu être jointe.',
      proofUnreadable: 'Ce fichier n’a pas pu être lu comme une image.',
      removePayment: 'Retirer ce versement',
      paymentRemoved: 'Versement retiré · la dette est rétablie',
      removeTitle: 'Retirer ce versement de {amount} ?',
      removeBody:
        'Encaissé le {date}. Le retirer fait réapparaître la dette : c’est de l’argent qu’on déclare ne plus avoir reçu. Le journal en garde la trace.',
      issueFor: 'Quittance — {unit}',
      issue: 'Quittance',
    },
    payments: {
      title: 'Suivi des paiements par période',
      subtitle: 'Un règlement partiel reste possible : le solde suit sur la période suivante.',
      filterAll: 'Tous',
      due: 'Dû',
      paid: 'Réglé',
      balance: 'Solde',
      /**
       * Le solde de TOUTES les périodes du bail, et non l'écart du mois.
       * « 120 000 » ne disait pas si la dette datait de ce mois-ci ou de deux
       * ans — la seule chose qui change la démarche à engager.
       */
      balanceTotal: 'Solde cumulé',
      /**
       * LA COLONNE D'ÉTAT NOMME SA PORTÉE, et c'est le seul écran où elle le doit.
       *
       * Ailleurs — le Parc, les locataires — « Statut » est sans ambiguïté : rien
       * à côté ne parle d'une autre période. Ici la colonne voisine annonce le
       * solde du BAIL ENTIER, et la pastille celui du MOIS. Deux portées côte à
       * côte dont une seule était nommée, avec un rouge d'un côté et un vert de
       * l'autre : la ligne avait l'air de se contredire.
       */
      statusMonth: 'Statut du mois',
      /**
       * Ce que la pastille verte ne dit pas.
       *
       * Elle va au même endroit que « +24 j » — le qualificatif de la pastille —
       * et pour la même raison : la pastille rend un verdict sur le mois, ce
       * mot dit ce qu'il faut savoir de plus pour le lire juste. Un seul mot,
       * comme son voisin : le montant est dans la colonne d'à côté.
       */
      carried: 'reliquat',
      outOfLease: 'hors bail',
      /* LA FENÊTRE DE LA GRILLE, parce que cet écran n'a aucun sélecteur de
         période et que six en-têtes au mois seul ne datent rien. */
      window: 'Périodes affichées : {from} à {to}',
      windowOne: 'Période affichée : {month}',
      legendPosts: 'Par cellule : loyer · eau · électricité',
      state: {
        paid: 'soldé',
        partial: 'partiel',
        overdue: 'impayé',
      },
      method: 'Moyen',
      date: 'Date',
      period: 'Période couverte',
      periodHint: 'Le mois que ce versement règle — pas forcément le mois où il est reçu.',
      paidOn: 'Date du versement',
      paidOnHint: 'Quand l’argent a été reçu. Distincte du mois qu’il règle.',
      reference: 'Référence de la transaction',
      note: 'Note interne',
      noteHint: 'Pour vous et votre gestionnaire. Le locataire ne la voit pas.',
      referenceShort: 'réf. {reference}',
      referenceHint: 'Numéro Mobile Money, référence du virement, numéro de chèque. C’est par lui que le versement se retrouve sur le relevé bancaire.',
      amount: 'Montant',
      amountHint: 'Un règlement partiel est accepté.',
      methodMobile: 'Mobile Money',
      methodCash: 'Espèces',
      methodTransfer: 'Virement',
      methodCheck: 'Chèque',
      modalTitle: 'Enregistrer un paiement',
      /**
       * Elle annonçait « Le locataire recevra sa quittance par e-mail et par
       * SMS ». La route d'émission n'appelle pas la messagerie, et celle-ci
       * journalise sans rien envoyer : personne ne recevait rien. Le produit
       * est honnête ailleurs — l'invitation dit « Aucun SMS n'a été envoyé » —,
       * cette phrase était la seule à affirmer le contraire.
       */
      modalDescription: 'La quittance est disponible dans l’espace du locataire dès l’enregistrement.',
      selectUnit: 'Unité',
      paidInFuture: 'Un versement ne peut pas être reçu à une date future.',
      amountInvalid: 'Saisissez un montant supérieur à zéro.',
      dueAmount: 'Dû : {amount}',
      /* LE RESTE, ET NON LE TOTAL — voir `RecordPaymentModal`, qui porte le
         relevé : le loyer seul se disait « Dû » sur un parc qui refacture
         l'eau et le courant, et un règlement partiel est accepté. */
      remainingAmount: 'Reste à encaisser : {amount}',
      overdueDays: '+{days} j',
      /* Relance et mise en demeure — la promesse de la grille tarifaire. */
      callRent: 'Appeler les loyers',
      rentCalled: '{count} échéances émises pour ce mois',
      rentCalled_one: '1 échéance émise pour ce mois',
      rentAlreadyCalled: 'Les loyers de ce mois ont déjà été appelés',
      /* DIRE CE QU'ON NE FAIT PAS, comme `noticeDemo` : « déjà appelés » y
         serait faux — la démonstration n'appelle rien et n'a rien à appeler. */
      rentCallDemo:
        'La démonstration n’appelle aucun loyer : il faut un parc réel pour émettre des échéances.',
      remind: 'Relancer les retards',
      remindTitle: 'Relancer {count} locataires en retard ?',
      remindTitle_one: 'Relancer 1 locataire en retard ?',
      remindBody:
        'Une trace datée est enregistrée au dossier de chaque bail. Un locataire déjà relancé aujourd’hui est ignoré : le produit ne relance pas deux fois le même jour.',
      remindDone: '{count} locataires relancés',
      remindDone_one: '1 locataire relancé',
      remindSkipped: '{count} déjà relancés aujourd’hui',
      remindSkipped_one: '1 déjà relancé aujourd’hui',
      remindNothing: 'Aucune relance : tous ont déjà été relancés aujourd’hui',
      /* DIRE CE QU'ON NE FAIT PAS. « Déjà relancés aujourd'hui » serait une
         raison inventée : la démonstration n'a personne à qui écrire. */
      remindDemo:
        'La démonstration n’envoie aucune relance : il faut un parc réel pour écrire aux locataires.',
      noticeFor: 'Mettre en demeure — {unit}',
      /* LE GESTE ORDINAIRE DE CET ÉCRAN, offert sur la ligne qui le demande.
         « Encaisser » et non « Enregistrer un paiement » : le verbe court tient
         à côté de deux autres commandes dans une cellule de geste. */
      collect: 'Encaisser',
      collectFor: 'Encaisser — {unit}',
      notice: 'Mettre en demeure',
      noticeTitle: 'Mettre en demeure {tenant} ?',
      noticeBody:
        'Acte engageant, qui précède la résiliation. Le motif et le montant dû sont figés au dossier et seront produits en cas de litige.',
      noticeReason: 'Motif',
      noticeReasonHint: 'Au moins 10 caractères. C’est le texte qui défendra la décision.',
      noticeReasonError: 'Un motif d’au moins 10 caractères est requis',
      noticeDone: 'Mise en demeure enregistrée au dossier du bail',
      noticeDemo:
        'En démonstration, rien n’est enregistré : une mise en demeure suppose un bail réel.',
      // En-tête de colonne de l'export : « +24 j » est une abréviation
      // d'affichage, illisible en tête d'une colonne de tableur.
      lateDays: 'Jours de retard',
    },

    readings: {
      title: 'Saisir un relevé',
      description:
        'Un compteur porte un index, pas une consommation : c’est l’écart avec le relevé précédent qui se refacture.',
      readAt: 'Relevé le',
      /* LA PÉRIODE SE DÉDUIT, et l'aide le dit plutôt que de le laisser
         découvrir : sans cette phrase, un relevé du 2 août passerait pour celui
         de juillet dans la tête de qui le saisit. */
      readAtHint: 'La période refacturée est le mois de cette date.',
      indexHint: 'L’index lu sur le compteur, pas la consommation.',
      /* AVEC LE PRÉCÉDENT SOUS LES YEUX — voir `RecordReadingModal` : un index
         ne se vérifie qu'en comparant, et un chiffre de trop ne se voyait
         qu'en refacturation. */
      indexHintPrevious: 'L’index lu sur le compteur. Dernier relevé : {index}.',
      unitRequired: 'Choisissez un logement.',
      oneRequired: 'Saisissez au moins un des deux index.',
      indexInvalid: 'Saisissez un index entier, positif ou nul.',
      indexBackwards: 'Index en recul pour {utility} : un compteur ne redescend pas.',
      alreadyRecorded: 'Un relevé existe déjà pour {utility} sur ce mois.',
      correctTitle: 'Corriger un relevé',
      indexAboveNext:
        'Index trop haut pour {utility} : le relevé du mois suivant lui est inférieur, la consommation d’après deviendrait négative.',
      corrected: '{count} relevés corrigés',
      corrected_one: '{count} relevé corrigé',
      removed: 'Relevé retiré',
      /* « MODIFIER » ET NON « CORRIGER », PARCE QUE C'EST CE QUE LE BOUTON DIT.
         Le bouton affiche `common.edit` — « Modifier » —, et ce nom-ci le
         REFORMULAIT en « Corriger ». Un `aria-label` écrase le contenu : le mot
         lisible disparaissait du nom, et qui commande à la voix dit ce qu'il lit
         (WCAG 2.5.3). Onze cas mesurés le 2026-09-27, dans les deux langues.
         Le logement RESTE — c'est la décision d'origine, « douze boutons à la
         suite ne disent pas lequel on active » — il s'ajoute simplement au
         libellé au lieu de le remplacer. */
      correctLine: 'Modifier les relevés — {unit}',
      /* DEUX GESTES, DEUX MOTS. « Modifier » sur une ligne vide promettrait la
         correction de rien ; c'est le même écart que « Saisir » et « Corriger »
         portent déjà en tête d'écran. */
      record: 'Saisir',
      recordLine: 'Saisir les relevés — {unit}',
      /* LES DEUX TOTAUX DE CONSOMMATION. Ce qu'un bailleur oppose à la facture
         de son compteur général est la SOMME des logements ; l'écart entre les
         deux est la perte. Le pied ne totalisait que l'argent. */
      totalVolume: '{volume} m³',
      totalPower: '{volume} kWh',
      removeWater: 'Retirer le relevé d’eau',
      removePower: 'Retirer le relevé d’électricité',
      confirmRemove: 'Confirmer le retrait',
      /* ELLE NE PARAÎT QU'EN CORRECTION, et elle dit ce qui surprendrait sinon :
         un relevé sert DEUX mois, et le corriger en déplace deux. */
      correctionSpread:
        'Ce relevé sert de point de départ au mois suivant : le corriger change aussi la consommation de ce mois-là.',
      saved: '{count} relevés saisis',
      saved_one: '{count} relevé saisi',
      chargeNotCalled:
        'Le loyer de ce mois n’a pas encore été appelé : la consommation entrera dans l’échéance au moment de l’appel.',
      chargeAlreadyPaid:
        'Un versement a déjà été reçu sur ce mois : l’échéance ne bouge plus, sans quoi le reçu déjà remis dirait autre chose que la quittance.',
    },
    tariffs: {
      title: 'Prix de refacturation',
      description:
        'L’eau et l’électricité sont refacturées à ces prix. Sans eux, les relevés s’affichent en quantités, sans montant.',
      utility: 'Énergie',
      price: 'Prix unitaire ({devise})',
      priceHint: 'Par mètre cube pour l’eau, par kilowattheure pour l’électricité.',
      demoNoSave:
        'La démonstration n’enregistre pas de prix : ceux de l’historique sont ceux qu’elle applique à ses relevés, et ils ne quittent pas la visite.',
      priceInvalid: 'Saisissez un prix entier supérieur à zéro.',
      effectiveFrom: 'À partir du',
      effectiveFromHint:
        'Un prix ne vaut pas pour le passé : les relevés antérieurs gardent celui qui était en vigueur.',
      effectiveFromHintCorrection:
        'Corriger ce prix change ce que TOUTES les périodes suivantes affichent, y compris passées : rien ne fige un prix une fois posé.',
      submit: 'Enregistrer ce prix',
      corrected: 'Prix corrigé',
      removed: 'Prix retiré',
      submitCorrection: 'Corriger ce prix',
      /* LE PRIX N'EST PAS DANS LE NOM ACCESSIBLE, l'énergie et la DATE le sont.
         C'est la date qui identifie une ligne — deux prix de l'eau peuvent
         partager un montant, jamais une date d'effet, l'unicité du schéma
         l'interdit.
         SANS « à partir du » : `prixEnVigueur` cherche le champ de date par
         `getByLabelText(/à partir du|effective/i)`, et ces noms-ci le
         trouvaient aussi — quatre boutons pour un champ. Une date accolée à son
         énergie se lit sans préposition. */
      correctLine: 'Corriger le prix — {utility}, {date}',
      removeLine: 'Retirer le prix — {utility}, {date}',
      confirmRemove: 'Confirmer le retrait',
      saved: 'Prix enregistré',
      duplicate: 'Un prix existe déjà pour cette énergie à cette date. Changez la date d’effet.',
      inForce: 'En vigueur',
      scheduled: 'À venir',
      historyTitle: 'Prix déjà posés',
      empty:
        'Aucun prix posé. Les relevés affichent les quantités relevées, sans montant refacturé.',
      open: 'Prix de refacturation',
    },

    parkSettings: {
      delegation: 'Délégation',
      delegationHint: 'Elle borne ce qu’un gestionnaire peut décider. En gestion seule, aucun code de gestionnaire n’est émis.',
      hasManagers: 'Un gestionnaire opère encore ce parc. Retirez son accès au registre des accès avant de passer en gestion seule.',
      open: 'Corriger le parc',
      title: 'Corriger le parc',
      description: 'Le nom, le pays, la devise et la délégation : les quatre choses qu’un parc est.',
      name: 'Nom du parc',
      nameRequired: 'Requis',
      notSet: '— non renseigné',
      demoNoSave:
        'La démonstration n\u2019enregistre rien : ce parc n\u2019existe que le temps de la visite. La devise, elle, se change tout de suite dans l\u2019en-tête — elle s\u2019applique à tous les montants affichés.',
      country: 'Pays',
      countryHint: 'Il détermine la zone monétaire proposée, sans l’imposer.',
      currency: 'Devise',
      currencyHint: 'L’unité de tous les montants du parc : loyers, paiements, refacturations.',
      // Les deux francs partagent « FCFA » à l'écran — même parité, monnaies
      // distinctes. Le stockage doit trancher, la zone le dit.
      currencyXAF: 'FCFA — Afrique centrale (CEMAC)',
      currencyXOF: 'FCFA — Afrique de l’Ouest (UEMOA)',
      // Les trois autres devises du parc sont celles que l'en-tête et
      // l'inscription proposent aussi : leur nom vit à `common.currencyNames`,
      // seul endroit d'où une devise se nomme.
      submit: 'Enregistrer',
      /**
       * Le second clic. Le libellé NOMME le geste au lieu de le confirmer :
       * « Confirmer » demanderait de se souvenir de ce qu'on confirme, alors
       * que c'est précisément le geste dont l'effet se lit mal.
       */
      confirmCurrency: 'Changer la devise',
      autoReminders: 'Relances automatiques',
      autoRemindersHint: 'Un courriel au locataire dont le loyer est en retard. Le message part une fois, au jour choisi.',
      autoRemindersOn: 'Relancer automatiquement',
      reminderDay: 'Au bout de combien de jours',
      reminderDayHint: 'Sept par défaut : ni le délai serré d’un jour, ni la sévérité de quinze.',
      reminderHour: 'À quelle heure',
      reminderHourHint: 'De 0 à 23, dans le fuseau choisi ci-dessous.',
      /* L'HEURE QUE ÇA FAIT CHEZ CELUI QUI RÈGLE — voir `ParkSettingsModal` :
         6 h en UTC part à 7 h à Douala, et l'aide ne disait que la règle. */
      reminderHourHintLocal:
        'De 0 à 23, dans le fuseau choisi ci-dessous — soit {heure} chez vous.',
      reminderChannel: 'Canal de la relance',
      /* COURTE À DESSEIN. La première rédaction expliquait ici que le produit
         écrit le canal réellement emprunté : deux lignes de plus sur un
         formulaire qui en porte déjà dix, pour une règle que la note du canal
         WhatsApp dit mieux et au moment où elle compte. Mesuré : 161 px de
         défilement en plus à 360, dont une quarantaine pour cette seule
         phrase. */
      reminderChannelHint: 'Par où part la relance automatique.',
      reminderChannelSms: 'SMS',
      reminderChannelWhatsApp: 'WhatsApp',
      /* LA CONTRAINTE EST DITE AVANT LE CHOIX, pas découverte après. Sans
         modèle approuvé, toutes les relances de ce parc cesseraient de partir
         sans qu'aucun écran n'explique pourquoi. */
      reminderChannelWhatsAppWarning:
        'WhatsApp exige un modèle de message approuvé par Meta pour tout envoi non sollicité. Sans ce modèle, les relances de ce parc resteront dans le produit sans partir.',
      reminderZone: 'Fuseau horaire',
      reminderZoneHint: 'Celui de vos locataires, qui n’est pas forcément le vôtre.',
      /* L'AIDE DIT CE QUI VA SE PASSER, PUIS CE QUI NE PEUT PAS SE PASSER.
         « Émet les échéances du mois » décrit le geste ; « les rappeler ne
         double rien » est ce qui autorise à essayer, et sans cette seconde
         moitié la case ne se coche pas — on ne branche pas à l'aveugle un
         réglage qui crée de l'argent dû. */
      autoRentCallOn: 'Appeler les loyers automatiquement',
      autoRentCallHint:
        'Les échéances du mois sont émises sans que personne ne clique, au jour choisi. Un mois déjà appelé n’est jamais appelé deux fois.',
      rentCallDay: 'Quel jour du mois',
      rentCallDayHint:
        'Du 1 au 28 — le plus grand jour que tout mois possède. Ce n’est pas le jour d’échéance, qui reste celui du bail.',
      currencyWarning:
        'Les montants déjà saisis ne seront pas convertis : 180 000 se relira 180 000 dans la nouvelle devise. À ne faire que sur un parc dont les montants seront resaisis.',
      unchanged: 'Rien n’a changé.',
      saved: 'Parc corrigé',
    },
    /*
      LES AUTOMATISMES DU PARC — la boîte née du découpage.
      
      Ses CHAMPS gardent leurs clés sous `parkSettings`, et ce n'est pas une
      négligence : ce sont bien des réglages de parc, les libellés n'ont pas
      changé d'un mot, et les renommer aurait fait un diff de deux cents lignes
      où rien de lisible ne bouge. Seule la CHROME de la boîte — son titre, son
      intitulé de menu, ses trois messages — est à elle, parce que c'est la
      seule chose que le découpage a créée.
    */
    parkAutomation: {
      open: 'Automatismes du parc',
      title: 'Automatismes du parc',
      /* LA DESCRIPTION DIT LA FRONTIÈRE, parce que deux entrées de menu
         voisines doivent se distinguer avant qu'on clique. */
      description:
        'Ce que ce parc fait tout seul : relancer un retard, appeler les loyers du mois.',
      submit: 'Enregistrer',
      unchanged: 'Rien n’a changé.',
      saved: 'Automatismes enregistrés',
      demoNoSave:
        'La démonstration n’enregistre rien : ce parc n’existe que le temps de la visite, et aucune relance ni aucun appel de loyer n’en part.',
    },
    /* LES DÉPENSES — l'écran. La modale de saisie vit sous `expenseEntry`,
       comme `readings` vit à côté de `meters` : deux branches, parce qu'une
       modale et son écran ne partagent presque aucun mot. */
    /* HONORAIRES ET COMPTE-RENDU DE GESTION — une modale ouverte depuis `Accès`,
       ligne par ligne de gestionnaire. Le barème appartient au MANDAT, et le
       mandat vit déjà là : un écran séparé aurait obligé à choisir un
       gestionnaire avant de rien voir, c'est-à-dire à refaire cette liste. */
    fees: {
      open: 'Honoraires et relevé',
      openLine: 'Honoraires et relevé — {name}',
      title: 'Honoraires de gestion',
      description:
        'Ce que ce gestionnaire facture, et le relevé de ce qu’il doit vous reverser sur la période.',
      /* Voir `works.status`. Ces trois-là viennent de `FeeBasis`. */
      basis: {
        percentOfCollected: 'Pourcentage de l’encaissé',
        fixedPerUnit: 'Forfait par logement géré',
        fixedPerMonth: 'Forfait mensuel',
      },
      basisLabel: 'Base de calcul',
      /* LE TAUX EN POUR CENT À L'ÉCRAN, EN POINTS DE BASE EN BASE. L'utilisateur
         tape « 8,5 » ; la base stocke 850. Aucun flottant ne survit à la
         saisie — le champ n'accepte qu'un nombre à une décimale, converti en
         entier avant l'envoi. */
      rate: 'Taux (%)',
      rateHint: 'Une décimale au plus : 8,5 se saisit « 8,5 ».',
      rateRequired: 'Un taux est nécessaire pour un pourcentage.',
      rateInvalid: 'Un taux entre 0,01 et 100 est attendu.',
      fixed: 'Forfait ({devise})',
      fixedRequired: 'Un montant est nécessaire pour un forfait.',
      startsOn: 'En vigueur depuis',
      endsOn: 'Jusqu’au',
      endsOnHint: 'Laissez vide si le barème court toujours.',
      /* LE RELEVÉ — cinq lignes, et la dernière est une soustraction. Elles sont
         toutes nommées : un relevé dont une ligne ne porte pas son nom n'est pas
         un compte-rendu, c'est un chiffre. */
      statement: 'Relevé de la période',
      collected: 'Encaissé',
      /* « SUR LE PÉRIMÈTRE CONFIÉ » et non « du parc » : c'est ce que CE
         gestionnaire a perçu, pas ce que le parc a perçu. Sans cette mention, un
         propriétaire lirait le chiffre comme celui de son parc entier. */
      collectedHint: 'Sur le périmètre confié à ce gestionnaire, et non sur le parc entier.',
      expensesOut: 'Dépenses',
      worksOut: 'Chantiers achevés',
      feeDue: 'Honoraires',
      net: 'Net à reverser',
      /* LE NET PEUT ÊTRE NÉGATIF, et la note le dit AVANT qu'on le lise. Sans
         elle, un montant négatif se lirait comme un défaut d'affichage. */
      netNegative: 'Vous devez de l’argent à ce gestionnaire sur cette période',
      netNegativeHint:
        'Les dépenses et les chantiers de la période dépassent l’encaissé. C’est un solde, pas une erreur : il se reporte ou se règle.',
      noFee: 'Aucun barème convenu',
      noFeeHint:
        'Le mandat existe sans honoraires : le relevé reste juste, il ne retient rien. Posez un barème pour que les honoraires soient calculés.',
      managedUnits: 'Logements gérés',
      /*
        ÉMETTRE, ET CE QUE LE MOT ENGAGE.
        
        « Arrêter le compte » serait plus juste en comptabilité, et moins clair
        pour qui ouvre cette boîte une fois par mois. « Émettre le compte-rendu »
        nomme le DOCUMENT qu'on produit, qui est ce qu'on remet.
        
        L'AIDE DIT L'IRRÉVERSIBILITÉ AVANT LE CLIC, parce que c'est la seule
        chose qu'on ne peut pas défaire dans cette boîte : rien ne réémet.
      */
      issue: 'Émettre le compte-rendu',
      issueHint:
        'Les montants et le taux de ce mois seront figés : le document ne suivra plus les lignes du parc. Un mois émis ne se réémet pas.',
      issued: 'Compte-rendu émis',
      /* « ÉMIS LE … » ET NON « FIGÉ LE … » : c'est une date de document, pas un
         détail technique, et c'est elle qu'un mandant cite. */
      issuedOn: 'Émis le {date} — les montants ne bougent plus.',
      issuedRate: 'taux de l’émission : {taux} %',
      /* LE CALCUL SE DIT AUSSI, et c'est la moitié qu'on oublie : sans cette
         ligne, on lirait des chiffres sans savoir s'ils sont arrêtés. */
      notIssued: 'Calculé à l’instant : ces montants suivent les lignes du parc jusqu’à l’émission.',
      alreadyIssued: 'Ce mois est déjà émis. Rouvrez la boîte pour voir le document.',
      noFeeToIssue:
        'Aucun barème convenu sur ce mandat : posez-en un avant d’émettre, sinon le document attesterait d’un accord qui n’existe pas.',
      periodShown: 'Période du relevé',
      save: 'Enregistrer le barème',
      saved: 'Barème enregistré',
      removeFee: 'Retirer le barème',
      confirmRemoveFee: 'Retirer le barème de ce gestionnaire ?',
      removedFee: 'Barème retiré',
      failed: 'Le barème n’a pas pu être enregistré.',
    },
    /* LE BAIL ET SES SÛRETÉS — une modale ouverte depuis le dossier d'un
       logement. UNE SEULE pour les trois gestes (congé, révision, garant) : ils
       portent tous sur le même bail, et trois boîtes auraient coûté trois fois
       les registres de géométrie pour trois formulaires de quatre champs. */
    vacancy: {
      title: 'Vacance',
      subtitle: 'Ce qui ne rapporte rien, et où en est-on pour y remédier.',
      open: 'Ouvrir une annonce',
      openTitle: 'Ouvrir une annonce',
      followTitle: 'Suivre l’annonce',
      modalDescription: 'Le loyer demandé, la date de disponibilité et les candidats.',
      openCta: 'Ouvrir l’annonce',
      publish: 'Publier',
      close: 'Fermer l’annonce',
      /* LE PREMIER INDICATEUR N'EST PAS UNE SOMME D'ANNONCES : un logement vide
         SANS annonce est le cas qui coûte, et une somme d'annonces l'aurait
         rendu invisible. */
      kpiEmpty: 'Logements vides',
      kpiEmptyNote: '{count} sans annonce en cours',
      kpiEmptyNote_one: '{count} sans annonce en cours',
      kpiPublished: 'Annonces publiées',
      kpiPublishedNote: '{count} au total, brouillons et fermées comprises',
      kpiPublishedNote_one: '{count} au total, brouillon et fermées comprises',
      kpiApplicants: 'Candidats',
      kpiApplicantsNote: 'Toutes annonces confondues',
      scopeNote:
        'Cet écran ne chiffre pas ce que la vacance coûte : le produit sait ce qu’un logement a rapporté, pas ce qu’il aurait rapporté.',
      colUnit: 'Logement',
      colStatus: 'État',
      colRent: 'Loyer demandé',
      colFrom: 'Disponible le',
      colApplicants: 'Candidats',
      status_draft: 'Brouillon',
      status_published: 'Publiée',
      status_closed: 'Fermée',
      empty: 'Aucune annonce',
      emptyHint: 'Une annonce porte le loyer demandé, la date de disponibilité et les candidats reçus.',
      unitUnknown: 'Logement retiré du parc',
      unit: 'Logement',
      unitHint: 'Seuls les logements sans bail en cours sont proposés.',
      noEmptyUnit: 'Aucun logement vide',
      rent: 'Loyer demandé',
      /* LA CRAINTE EST RÉELLE : on hésite à écrire un autre prix si l'on croit
         écraser la référence du logement. */
      rentHint: 'Le loyer de référence du logement n’est pas modifié.',
      deposit: 'Caution demandée',
      availableFrom: 'Disponible à partir du',
      availableFromHint: 'Une annonce publiée avant un départ est ce qui évite la vacance.',
      description: 'Texte de l’annonce',
      /* LE LIEN PUBLIC D'UNE ANNONCE. « Copier le lien » et non « Partager » :
         le produit ne partage rien, il met une adresse dans le presse-papiers,
         et c'est le bailleur qui l'envoie où il veut. */
      copyLink: 'Copier le lien public',
      linkCopied: 'Lien copié',
      askingLine: 'Demandé : {rent} de loyer, {deposit} de caution.',
      applicantsTitle: 'Candidats',
      applicantsNone: 'Aucun candidat pour l’instant.',
      applicantName: 'Nom du candidat',
      applicantPhone: 'Téléphone',
      applicantReachHint: 'Un téléphone ou une adresse suffit — il faut pouvoir le rappeler.',
      applicantEmail: 'Adresse électronique',
      applicantOn: 'S’est présenté le',
      applicantAdd: 'Ajouter le candidat',
      applicantFollow: 'Suite donnée à {name}',
      applicant_received: 'Reçu',
      applicant_visited: 'A visité',
      applicant_accepted: 'Accepté',
      applicant_declined: 'Refusé',
      applicantAdded: 'Candidat enregistré.',
      applicantIncomplete: 'Un nom et une date sont nécessaires.',
      applicantNeedsReach: 'Un téléphone ou une adresse est nécessaire pour rappeler ce candidat.',
      listingOpened: 'Annonce ouverte, en brouillon.',
      listingUpdated: 'Annonce mise à jour.',
      listingIncomplete: 'Un logement, un loyer et une date de disponibilité sont nécessaires.',
      unitOccupied: 'Ce logement a un bail en cours sans départ annoncé.',
      failed: 'L’opération n’a pas pu être enregistrée.',
    },
    leaseCharges: {
      open: 'Charges et régularisation',
      title: 'Charges du bail',
      linesTitle: 'Charges convenues',
      linesNone: 'Aucune charge convenue — seuls le loyer, l’eau et le courant sont appelés.',
      lineLabel: 'Libellé',
      lineAmount: 'Montant par mois',
      lineKind: 'Nature',
      /* LA DISTINCTION DÉCIDE DU DÉCOMPTE, et elle est invisible sur la
         quittance : on l'écrit ici, au moment où elle se choisit. */
      lineKindHint:
        'Une provision est une avance : elle revient au locataire si le bailleur a engagé moins. Un forfait est dû quoi qu’il arrive.',
      kindProvision: 'Provision',
      kindForfait: 'Forfait',
      addLine: 'Ajouter la charge',
      lineAdded: 'Charge convenue.',
      lineRemoved: 'Charge retirée. Les quittances déjà émises ne changent pas.',
      lineDuplicate: 'Ce bail porte déjà une charge de ce libellé.',
      lineIncomplete: 'Un libellé et un montant sont nécessaires.',
      removeLine: 'Retirer la charge {label}',
      settlementTitle: 'Régularisation',
      settlementRange: 'Exercice du {from} au {to}',
      balanceToRefund: '{amount} à rendre au locataire',
      balanceToCollect: '{amount} à réclamer au locataire',
      periodStart: 'Début de l’exercice',
      periodEnd: 'Fin de l’exercice',
      draftProvisioned: 'Provisions appelées',
      draftUnitExpenses: 'Dépenses du logement',
      draftBuildingExpenses: 'Dépenses de l’immeuble',
      /* LES DEUX NE S'ADDITIONNENT PAS, et le produit ne sait pas les répartir :
         on le dit plutôt que d'afficher un total qui serait pris pour argent
         comptant. */
      draftNoKey:
        'Les dépenses de l’immeuble ne sont pas réparties : le produit n’a ni tantièmes ni surfaces. À vous de retenir la part qui revient à ce logement.',
      actualAmount: 'Dépenses retenues',
      actualAmountHint: 'La somme que vous opposez au locataire pour cet exercice.',
      settledOn: 'Arrêté le',
      note: 'Observation',
      settle: 'Arrêter le décompte',
      settled: 'Décompte arrêté.',
      settlementDuplicate: 'Cet exercice a déjà été régularisé.',
      settlementIncomplete: 'Une date d’arrêté et un montant sont nécessaires.',
      failed: 'L’opération n’a pas pu être enregistrée.',
    },
    lease: {
      open: 'Bail et sûretés',
      openLine: 'Bail et sûretés — {unit}',
      title: 'Bail et sûretés',
      description:
        'Le congé s’il est donné, l’historique des révisions de loyer, et les personnes qui se portent garantes.',
      /* ── LE CONGÉ ── */
      noticeTitle: 'Congé',
      /* « AUCUN CONGÉ DONNÉ » et non une case vide : l'absence de congé est un
         état du bail, pas une donnée qu'on aurait omise. */
      noticeNone: 'Aucun congé donné',
      noticeNoneHint: 'Le bail court sans fin annoncée.',
      /* Voir `works.status`. Ces deux-là viennent de `NoticeGiver`. */
      giver: {
        tenant: 'Par le locataire',
        landlord: 'Par le bailleur',
      },
      givenOn: 'Congé reçu le',
      givenBy: 'Donné par',
      moveOutOn: 'Départ le',
      moveOutHint: 'Le bail reste actif jusqu’à cette date : le loyer est encore appelé.',
      noticeReason: 'Motif',
      giveNotice: 'Enregistrer un congé',
      noticeSaved: 'Congé enregistré',
      withdrawNotice: 'Retirer le congé',
      confirmWithdrawNotice: 'Retirer ce congé ?',
      noticeWithdrawn: 'Congé retiré',
      moveOutBeforeNotice: 'La date de départ ne peut pas précéder le congé.',
      leaseAlreadyEnded: 'Ce bail est déjà terminé : il n’y a plus de congé à donner.',
      /* ── LA RÉVISION DE LOYER ── */
      revisionTitle: 'Loyer',
      currentRent: 'Loyer courant',
      newRent: 'Nouveau loyer ({devise})',
      newRentRequired: 'Un nouveau loyer est nécessaire.',
      effectiveOn: 'À compter du',
      /* CE QUE LA RÉVISION NE FAIT PAS, dit avant qu'on la fasse : les
         quittances déjà émises gardent leur loyer, et c'est juste. */
      effectiveHint: 'Les échéances déjà appelées gardent leur loyer : une quittance remise ne se réécrit pas.',
      revisionReason: 'Motif de la révision',
      revise: 'Réviser le loyer',
      revisionSaved: 'Loyer révisé',
      sameRent: 'Ce loyer est déjà celui du bail.',
      revisionExists: 'Une révision porte déjà cette date d’effet.',
      revisionsEmpty: 'Aucune révision',
      revisionLine: 'De {avant} à {apres}, au {date}',
      /* ── LES GARANTS ── */
      /* ── LE PLAN D'APUREMENT ── */
      planTitle: 'Plan d’apurement',
      /* « AUCUN ACCORD » ET NON UNE SECTION MUETTE : un impayé sans plan est un
         état, et c'est celui où l'on propose d'en convenir un. */
      planNone: 'Aucun accord en cours',
      planNoneHint:
        'Un accord suspend les relances tant qu’il est respecté. Sans lui, le produit ne connaît que « payé » ou « pas payé ».',
      planAgreedOn: 'Convenu le',
      planTotal: 'Total échelonné',
      planPaid: 'Déjà imputé',
      /* CE QUI EST IMPUTÉ, et non ce qui est encaissé : un locataire qui paie
         plus que son plan a soldé son plan, le surplus va à ses loyers. */
      planPaidHint:
        'Déduit des encaissements du bail depuis l’accord, imputés dans l’ordre des échéances. Le surplus va aux loyers courants.',
      planInstalment: '{date} · {montant}',
      planInstalmentPaid: '{date} · {montant} — réglé',
      planInstalmentPartial: '{date} · {montant} — {paye} imputés',
      planAddInstalment: 'Ajouter une échéance',
      planDueOn: 'Échéance le',
      planAmount: 'Montant ({devise})',
      planNote: 'Ce qui a été convenu',
      planNoteHint: 'Ce que le barème ne dit pas : « après la vente de sa moto », « son employeur retient sur salaire ».',
      planCreate: 'Convenir d’un plan',
      planCreated: 'Plan convenu',
      planNeedsInstalment: 'Au moins une échéance est nécessaire.',
      planDuplicateDate: 'Deux échéances ne peuvent pas porter la même date.',
      planExists: 'Ce bail a déjà un plan en cours.',
      planClosed: 'Ce plan est déjà clos.',
      /* TROIS SORTS DISTINCTS, et la distinction compte l'an prochain : l'un a
         payé, l'autre a rompu, le troisième s'est vu retirer l'accord. */
      planHonour: 'Marquer honoré',
      planBreak: 'Marquer rompu',
      planCancel: 'Retirer l’accord',
      planClosedDone: 'Plan clos',
      planFailed: 'Le plan n’a pas pu être enregistré.',
      guarantorsTitle: 'Garants',
      guarantorsEmpty: 'Aucun garant',
      /* LA CAUTION EN ARGENT N'EST PAS UNE PERSONNE : on le dit, parce que le
         produit porte les deux et que les confondre coûte un recours. */
      guarantorsHint: 'La caution retenue est de l’argent ; un garant est une personne qui s’engage à payer.',
      guarantorName: 'Nom du garant',
      guarantorNameRequired: 'Un nom est nécessaire.',
      guarantorPhone: 'Téléphone',
      guarantorEmail: 'Courriel',
      guarantorRelation: 'Lien avec le locataire',
      guarantorRelationHint: 'En clair : « père », « employeur ».',
      guarantorContactRequired: 'Un téléphone ou un courriel est nécessaire : un garant qu’on ne peut pas joindre ne sert à rien.',
      addGuarantor: 'Ajouter un garant',
      guarantorAdded: 'Garant ajouté',
      removeGuarantorLine: 'Retirer le garant — {name}',
      confirmRemoveGuarantor: 'Retirer ce garant ?',
      guarantorRemoved: 'Garant retiré',
      failed: 'L’enregistrement a échoué.',
    },
    expenses: {
      title: 'Dépenses',
      subtitle:
        'Ce que le parc a payé sur le mois : taxes, assurances, syndic, factures du distributeur, entretien. Les chantiers sont comptés à part.',
      /* Voir `works.status`. Ces six-là viennent de `ExpenseCategory`. */
      category: {
        tax: 'Taxe',
        insurance: 'Assurance',
        syndic: 'Syndic',
        utility: 'Eau et électricité',
        upkeep: 'Entretien',
        other: 'Autre',
      },
      /* TROIS INDICATEURS ET NON DEUX : le total ne se lit pas sans ses deux
         moitiés, et les moitiés ne se lisent pas sans leur somme. Un lecteur
         qui n'aurait que le total ne saurait pas qu'un chantier en fait partie
         sans figurer dans le tableau. */
      totalOut: 'Total sorti',
      fromExpenses: 'Dont dépenses saisies',
      fromWorks: 'Dont chantiers achevés',
      /* La note qui explique pourquoi le tableau ne somme pas au total. Elle
         est INCONDITIONNELLE : la règle vaut même un mois sans chantier, et
         c'est justement ce mois-là qu'on croirait le tableau complet. */
      worksApart: 'Les chantiers ne sont pas dans ce tableau',
      worksApartHint:
        'Un chantier porte déjà son montant approuvé dans l’écran Travaux. Le recopier ici en ferait une seconde vérité, libre de diverger.',
      periodShown: 'Mois affiché',
      /* Le même verrou que celui du parc, dit dans les mêmes termes : ce n'est
         pas une panne du sélecteur, c'est la démonstration qui n'a qu'un mois. */
      periodLockedInDemo: 'Changer de mois — la démonstration ne porte qu’un mois',
      label: 'Libellé',
      amount: 'Montant',
      incurredOn: 'Engagée le',
      paidOn: 'Réglée le',
      scope: 'Portée',
      /* Les trois portées, dites en mots plutôt qu'en identifiants. « Le parc »
         n'est pas un immeuble sans nom : c'est une dépense qui n'appartient à
         aucun. */
      scopePark: 'Le parc',
      /* Une dépense engagée et non réglée n'est pas une donnée manquante :
         c'est un état, et il porte son mot plutôt qu'un tiret. */
      unpaid: 'Non réglée',
      add: 'Saisir une dépense',
      editLine: 'Corriger la dépense — {label}',
      removeLine: 'Retirer la dépense — {label}',
      confirmRemove: 'Retirer cette dépense ?',
      remove: 'Retirer',
      removed: 'Dépense retirée',
      empty: 'Aucune dépense sur ce mois',
      emptyHint: 'Saisissez une taxe, une prime d’assurance ou une facture réglée pour le parc.',
    },
    /* LA SAISIE D'UNE DÉPENSE — la modale. Elle sert la saisie ET la
       correction : les champs sont les mêmes, seule l'adresse de l'écriture
       change. Deux boîtes jumelles divergeraient au premier ajustement. */
    expenseEntry: {
      title: 'Saisir une dépense',
      correctTitle: 'Corriger la dépense',
      description:
        'Ce que le parc a payé, et pour quoi. La devise est celle du parc — elle ne se choisit pas ici.',
      category: 'Famille',
      label: 'Libellé',
      labelHint: 'Ce que vous relirez dans un an : « Taxe foncière 2026 », « Prime multirisque Bastos ».',
      labelRequired: 'Un libellé est nécessaire pour retrouver la ligne.',
      amount: 'Montant ({devise})',
      amountRequired: 'Un montant est nécessaire.',
      amountInvalid: 'Un montant strictement positif est attendu.',
      incurredOn: 'Engagée le',
      incurredOnHint: 'Le jour où la dépense est née, et non celui où vous la saisissez.',
      incurredOnRequired: 'Une date d’engagement est nécessaire.',
      paidOn: 'Réglée le',
      /* La date de règlement est FACULTATIVE, et son absence a un sens : la
         dépense est engagée, pas encore payée. L'indice le dit, faute de quoi
         un champ vide passerait pour un oubli. */
      paidOnHint: 'Laissez vide si elle n’est pas encore payée.',
      scope: 'Portée',
      scopeHint: 'Le parc entier, un immeuble, ou un seul logement — jamais deux à la fois.',
      scopePark: 'Le parc entier',
      note: 'Note',
      saved: 'Dépense enregistrée',
      corrected: 'Dépense corrigée',
      /* Ce refus vient du serveur et non de la validation locale : il dit que
         l'immeuble ou le logement visé n'est pas dans le périmètre. */
      outOfScope: 'Cet immeuble ou ce logement n’est pas dans votre périmètre.',
      failed: 'La dépense n’a pas pu être enregistrée.',
    },
    meters: {
      title: 'Relevé des compteurs',
      subtitle:
        'Index relevés sur place. La consommation est refacturée au prorata sur la quittance du mois.',
      /* Voir `works.status`. Ces deux-là viennent de `Utility`. */
      utility: {
        water: 'Eau',
        power: 'Électricité',
      },
      previous: 'Index précédent',
      current: 'Index du mois',
      consumption: 'Consommation',
      rebilled: 'Refacturé',
      readAt: 'Relevé le',
      missing: 'Relevé manquant',
      /* « TRIER PAR RELEVÉ » et non « par état » : sur cet écran l'état d'une
         ligne EST son relevé — saisi ou pas —, et « état » se dispute déjà avec
         les états des lieux, voisins dans la barre latérale. */
      /* « Période relevée » et non « mois » : la table du serveur s'adresse
         par `periodStart`, et une période peut ne pas coïncider avec un mois
         calendaire sur un parc qui relève à date glissante. */
      periodShown: 'Période relevée',
      filterLabel: 'Trier par relevé',
      filterAll: 'Tous',
      filterDone: 'Relevé saisi',
      firstReading: 'Premier relevé',
      noPrice: 'Tarif non fixé',
      missingCount: '{count} relevés manquants pour la période',
      missingCount_one: '{count} relevé manquant pour la période',
      /* LE MANQUE PORTE UN NOM plutôt qu'une cellule vide : il ne dit pas
         QUEL logement, on l'ignore — il dit qu'il y en a un. */
      unknownUnit: 'Logement inconnu',
      unknownUnits: '{count} logements que ce parc ne connaît pas',
      unknownUnits_one: '{count} logement que ce parc ne connaît pas',
      missingHint: 'La facturation du mois restera incomplète tant qu’ils ne sont pas saisis.',
      /* DEUX TOURNÉES DIFFÉRENTES, DEUX NOTES. L'une envoie RELEVER un compteur
         qu'on n'a pas lu ; celle-ci envoie VÉRIFIER une installation qu'on a lue.
         « Notable » et non « anormal » : un index mal recopié et un visiteur
         installé un mois doublent aussi, et accuser coûte plus cher que dire. */
      gapCount: '{count} consommations ont au moins doublé',
      gapCount_one: '1 consommation a au moins doublé',
      gapHint: 'À vérifier avant de refacturer : une fuite, un appareil resté en marche, ou un index mal recopié.',
      /* LE MULTIPLE SANS SA RÉFÉRENCE EST UN NOMBRE FLOTTANT. L'œil voit la
         colonne entière et retrouve le mois d'avant ; le lecteur d'écran, non. */
      gapAria: 'le mois précédent en comptait {reference}',
      complete: 'Tous les relevés sont saisis pour la période.',
      totalRebilled: 'Total refacturé',
      capturedCount: '{done} sur {total} saisis',
    },

    inspections: {
      record: 'Établir un état des lieux',
      recordBody: 'Entrée ou sortie, pièce par pièce. Les réserves d’entrée ne se chiffrent pas : elles constatent ce qui est déjà abîmé, pour que le locataire n’en réponde pas.',
      recorded: 'État des lieux enregistré',
      /* L'ÉTAT DES LIEUX EST BIEN ENREGISTRÉ — c'est la seconde moitié qui
         manquait. Les photos d'une réserve sont les pièces qu'on oppose pour
         retenir une somme sur une caution : les perdre en silence enseignerait
         le produit à l'envers. */
      photosDemo:
        'État des lieux enregistré. La démonstration ne conserve pas les photos : il faut un parc réel pour les attacher aux réserves.',
      unit: 'Logement',
      kind: 'Nature',
      performedOn: 'Date du constat',
      roomCount: 'Nombre de pièces',
      roomsError: 'Un nombre de pièces supérieur à zéro est requis',
      signedBy: 'Signé par',
      signedHint: 'Laissez vide s’il n’est pas encore signé : un état des lieux non signé n’engage personne.',
      findings: 'Réserves',
      room: 'Pièce',
      roomError: 'Nommez la pièce, ou retirez la ligne',
      finding: 'Constat',
      findingError: 'Décrivez le constat, ou retirez la ligne',
      cost: 'Imputation',
      severity: 'Gravité',
      /**
       * DEUX libellés pour la gravité, et non le réemploi de `major`.
       *
       * Celui-ci se sert en fin de phrase — « Vitre fêlée · dégradé » — et vit
       * donc en minuscule. Une commande porte un libellé, pas une incise : le
       * réemployer mettrait « dégradé » à côté de « Entrée » et « Sortie » dans
       * la même rangée de boutons.
       */
      severityMinor: 'Léger',
      severityMajor: 'Dégradé',
      /**
       * LES PHOTOS D'UNE RÉSERVE.
       *
       * Le compte est ÉCRIT en permanence — « 2 / 8 » — et non seulement quand
       * la limite est atteinte. Une borne qu'on ne découvre qu'en butant dedans
       * est une borne silencieuse : celle-ci n'est pas mesurée sur un appareil
       * réel, et la rendre visible est le moins qu'on doive à qui la subira.
       */
      photoAdd: 'Ajouter une photo à la réserve n° {rank}',
      photoCount: '{done} / {max}',
      photoFull: 'Huit photos par réserve, c’est le maximum tenu en mémoire. Retirez-en une pour en ajouter une autre.',
      photoRemove: 'Retirer la photo {index} de la réserve n° {rank}',
      photoAlt: 'Photo {index} de la réserve n° {rank}',
      /**
       * LE REFUS DIT QUOI FAIRE. « Format non pris en charge » laisse
       * l'utilisateur devant un appareil qu'il ne sait pas régler ; le chemin
       * exact du réglage iOS le débloque en trente secondes.
       */
      photoHeic:
        'Cette photo est au format HEIC, qu’aucun navigateur ne sait ouvrir. Votre iPhone peut enregistrer en JPEG : Réglages → Appareil photo → Formats → Le plus compatible.',
      photoUnreadable: 'Ce fichier n’est pas une image que le navigateur sait ouvrir. Choisissez une photo JPEG ou PNG.',
      photoUploadFailed:
        'L’envoi de {count} photos a échoué. L’état des lieux est enregistré ; ses réserves ne portent pas encore ces photos. Réessayez sans fermer cette fenêtre.',
      photoUploadFailed_one:
        'L’envoi d’une photo a échoué. L’état des lieux est enregistré ; sa réserve ne porte pas encore cette photo. Réessayez sans fermer cette fenêtre.',
      photoConfirmFailed:
        '{count} photos sont montées mais n’ont pas été confirmées : elles ne sont pas encore attachées à la réserve. Réessayez sans fermer cette fenêtre — fermer les perdrait.',
      photoConfirmFailed_one:
        'Une photo est montée mais n’a pas été confirmée : elle n’est pas encore attachée à la réserve. Réessayez sans fermer cette fenêtre — fermer la perdrait.',
      photoRetry: 'Reprendre l’envoi des photos',
      addFinding: 'Ajouter une réserve',
      noFindings: 'Aucune réserve : l’état des lieux sera enregistré sans dégât constaté.',
      roomPlaceholder: 'Séjour',
      findingPlaceholder: 'Fissure au-dessus de la fenêtre',
      findingRank: 'Réserve n° {rank}',
      removeFinding: 'Retirer la réserve n° {rank}',
      /**
       * LA RÉSERVE REPLIÉE EN CARTE, à la demande et jamais d'office.
       *
       * Le rang est dans le libellé VISIBLE, comme sur « Ajouter une photo à la
       * réserve n° 1 » : trois boutons « Terminer » dans un même formulaire ne
       * se distingueraient ni à l'œil ni à l'oreille.
       */
      finishFinding: 'Terminer la réserve n° {rank}',
      editFinding: 'Modifier la réserve n° {rank}',
      costOf: 'Imputation : {amount}',
      photoTotal: '{count} photos',
      photoTotal_one: '{count} photo',
      title: 'États des lieux',
      subtitle: 'Entrée et sortie comparées pièce par pièce, réserves chiffrées et imputées sur la caution.',
      /* Ni indicateur ni compte : l'écran alignait des dossiers sans dire
         combien de logements avaient un état des lieux complet — la seule
         chose qui décide s'il reste du travail avant une restitution. */
      kpiComplete: 'Dossiers complets',
      kpiCompleteNote: 'entrée et sortie signées',
      kpiPartial: 'Entrée seule',
      kpiPartialNote: 'la sortie reste à faire',
      kpiNone: 'Sans état des lieux',
      kpiNoneNote: 'aucune pièce contradictoire',
      /* Voir `works.status`. Ces deux-là viennent de `InspectionKind`.

         `kinds` AU PLURIEL, et ce n'est pas une coquetterie : `kind` existait
         déjà dans cette famille — c'est le libellé « Nature » du champ de
         formulaire. Le sous-bloc l'aurait ÉCRASÉ. Attrapé par `tsc`, qui refuse
         deux propriétés du même nom ; sans lui, la collision aurait été
         silencieuse, et c'est exactement le défaut que ce remaniement existe
         pour rendre impossible. */
      /* L'ÉTAT DES LIEUX DÉJÀ ENREGISTRÉ — voir `InspectionModal` : le serveur
         n'en accepte qu'un par bail et par nature, et le refus arrivait après
         les photos. */
      alreadyRecorded:
        'Un état des lieux d’{kind} existe déjà pour ce logement, daté du {date}.',
      kinds: {
        entry: 'Entrée',
        exit: 'Sortie',
      },
      rooms: '{count} pièces',
      rooms_one: '{count} pièce',
      issues: '{count} réserves',
      issues_one: '{count} réserve',
      noIssues: 'Aucune réserve',
      signed: 'Signé',
      unsigned: 'En attente de signature',
      compare: 'Entrée et sortie',
      /**
       * Le NOM de la liste des dossiers.
       *
       * Une liste sans nom s'annonce « liste, 3 éléments » : le compte sans
       * l'objet. Six autres listes vivent déjà sur cet écran — les réserves,
       * dans les cellules du tableau — et rien ne dirait laquelle porte les
       * logements.
       */
      byUnit: 'États des lieux par logement',
      /**
       * La comparaison entrée/sortie, pièce par pièce.
       *
       * « Bon état » plutôt qu'une case vide : sur un tableau de comparaison, le
       * vide se lit comme une donnée manquante, alors qu'ici il dit quelque
       * chose de précis.
       */
      comparison: 'Comparaison entrée / sortie',
      colRoom: 'Élément',
      colWithheld: 'Retenue',
      noWithhold: '—',
      asGood: 'Bon état',
      major: 'dégradé',
      proposed: 'Retenue proposée sur la caution',
      /**
       * LES PREUVES, DU CÔTÉ DE QUI LES REÇOIT.
       *
       * Le mot est choisi : ce ne sont pas « les photos », ce sont les pièces
       * qu'on oppose. Le locataire à qui l'on retient une somme lit ici ce qui
       * la fonde, et le bailleur relit ce qu'il pourra produire.
       *
       * Le texte de remplacement d'une vignette porte le CONSTAT et non « photo
       * de réserve » : un lecteur d'écran qui annonce trois fois « photo » ne
       * dit rien de plus qu'un silence.
       */
      proofs: 'Preuves',
      proofAlt: 'Photo {index} sur {total} — {finding}',
      proofMissing: 'Photo indisponible',
      emptyTitle: 'Aucun état des lieux enregistré',
      emptyBody:
        'Un état des lieux d’entrée se fait à la remise des clés, celui de sortie à leur restitution : c’est leur comparaison qui justifie ce qu’on retient sur la caution.',
    },

    works: {
      title: 'Travaux et signalements',
      subtitle: 'Le locataire signale, le gestionnaire chiffre, le propriétaire arbitre.',
      /* LES STATUTS DANS LEUR PROPRE BLOC. Ils viennent de `WorkStatus`, en base,
         et l'écran compose leur clé. Mêlés aux quatre-vingts libellés de cet
         écran, une valeur d'énumération qui porterait le nom d'un libellé
         existant — un statut `title` — s'afficherait SILENCIEUSEMENT à sa place :
         bon emplacement, mauvais texte, aucune rougeur. Isolés, ils se gardent. */
      status: {
        reported: 'Signalé',
        quoted: 'Devis proposé',
        approved: 'Validé',
        done: 'Terminé',
      },
      urgent: 'Urgent',
      noQuote: 'Pas encore chiffré',
      /**
       * D'où vient l'intervention, et de qui.
       *
       * Quatre clés et non deux : le nom manque sur les interventions
       * antérieures au champ, et « Signalé par » suivi de rien se lirait comme
       * un défaut d'affichage. La phrase entière change plutôt que de laisser
       * un trou.
       *
       * « Ouvert par » et non « signalé par » pour le bailleur : il ne constate
       * pas un problème chez quelqu'un d'autre, il décide un chantier. Deux
       * gestes, deux verbes.
       */
      reportedBy: 'Signalé par le locataire',
      reportedByNamed: 'Signalé par {name}',
      openedBy: 'À l’initiative du bailleur',
      openedByNamed: 'Ouvert par {name}',
      /* Le montant dit ce qu'il EST : un nombre nu à côté d'une pastille de
         statut laissait deviner s'il s'agissait d'une proposition ou d'une
         dépense. */
      /* « Devis » et non « Devis proposé » : cette dernière chaîne est DÉJÀ le
         libellé du statut `quoted`, juste au-dessus. Deux choses différentes
         sous le même mot — l'état d'une intervention et la nature d'un montant
         — se confondraient à l'écran comme elles se confondaient dans les cas
         qui comptent les statuts, et qui ont eu raison de tomber. */
      amountQuoted: 'Devis',
      amountApproved: 'Engagé',
      amountWasQuoted: 'devisé {amount}',
      /**
       * Le bailleur OUVRE un chantier — il ne le signale pas.
       *
       * Le vocabulaire de `app.report` est entièrement tourné vers le
       * locataire : « votre gestionnaire et votre bailleur le reçoivent
       * immédiatement », « le devis et le corps de métier, ce n'est pas à vous
       * de les fixer ». Servi au bailleur lui-même, il ne veut plus rien dire.
       * Deux gestes, deux verbes, deux jeux de mots.
       */
      openCta: 'Ouvrir un chantier',
      openTitle: 'Ouvrir un chantier',
      openBody: 'Une intervention que vous décidez, sans qu’un locataire l’ait signalée. Elle apparaîtra dans la liste comme les autres, et se chiffre ensuite.',
      openUnit: 'Sur quel logement ?',
      /* « Que faut-il faire ? » et non « De quoi s'agit-il ? » : cette
         dernière est DÉJÀ la légende du choix des métiers, quinze pixels plus
         bas dans la même modale. Deux questions distinctes sous le même
         libellé, et un formulaire qui demande deux fois la même chose. */
      openWhat: 'Que faut-il faire ?',
      openWhatHint: 'Une phrase suffit. Le devis vient après.',
      openWhatPlaceholder: 'Ravalement de la façade côté cour',
      openSubmit: 'Ouvrir le chantier',
      openedToast: 'Chantier ouvert · il attend son devis',
      /**
       * Le tri par ORIGINE, pour le bailleur seul.
       *
       * Deux questions distinctes qu'une liste mêlée ne servait ni l'une ni
       * l'autre : « qu'est-ce qu'on me signale ? » et « qu'est-ce que j'ai
       * engagé de ma propre initiative ? ».
       */
      /* LE NOM DU GROUPE, DÉSORMAIS VISIBLE — et raccourci pour cela. Il ne
         servait qu'à l'`aria-label`, où une phrase passe ; posé devant les
         pastilles, « Trier par origine » redirait en quatre mots ce que la
         rangée montre. Il disait aussi « trier » là où l'on FILTRE. */
      filterOrigin: 'Origine',
      filterAll: 'Toutes',
      /* « TOUS LES ÉTATS » ET NON « TOUTES ». Cet écran porte DEUX tris côte
         à côte depuis le lot du second axe, et le mot « Toutes » figurait
         déjà sur la barre voisine : deux pastilles au libellé identique, à
         quinze centimètres l'une de l'autre, dont l'une ne rend pas ce que
         l'autre rend. L'`aria-label` du groupe les sépare pour un lecteur
         d'écran ; rien ne les séparait pour l'œil. Le libellé dit donc
         quel axe il relâche. */
      filterAllStatuses: 'Tous les états',
      filterStatus: 'État',
      filterReported: 'Signalées',
      filterOpened: 'À mon initiative',
      /* ENGAGÉ et non devisé : un devis proposé n'est pas une dépense, et
         l'additionner ferait passer pour engagé ce qui attend un arbitrage. */
      /* « Total engagé » et non « Engagé » : ce dernier est déjà le libellé que
         chaque ligne porte sous son montant, à quelques centimètres. Le même
         mot pour la somme et pour ses termes — c'est la troisième fois que ce
         motif se présente, et la première où il est vu avant livraison. */
      totalCommitted: 'Total engagé',
      /**
       * LA RANGÉE D'INDICATEURS QUI MANQUAIT À CET ÉCRAN.
       *
       * Il comptait déjà tout — le total engagé, les devis en attente, les
       * chantiers ouverts — et n'en montrait qu'un seul, en texte libre à côté
       * des filtres. Ses cinq écrans voisins ouvrent tous sur une rangée de
       * cartes ; celui-ci demandait de lire cinq fiches pour savoir combien il
       * y avait à arbitrer.
       */
      kpiQuoted: 'Devis à arbitrer',
      kpiQuotedNote: '{amount} proposés',
      kpiOngoing: 'Chantiers en cours',
      kpiOngoingNote: '{count} encore à chiffrer',
      kpiOngoingNote_one: '{count} encore à chiffrer',
      kpiCommittedNote: 'sur les interventions affichées',
      /* L'état vide s'adresse au bailleur, à qui le geste est désormais
         offert. La phrase disait « une intervention naît d'un signalement de
         locataire » : c'était vrai, ça ne l'est plus. */
      emptyBodyOwner: 'Un locataire signale ce qu’il constate, et vous ouvrez ce que vous décidez. Les deux se rejoignent ici.',
      approve: 'Valider le devis',
      complete: 'Marquer terminé',
      completed_toast: 'Intervention close · elle sort des travaux à faire',
      urgency_blocking: 'Bloquant',
      urgency_normal: 'Normal',
      urgency_low: 'Faible',
      /**
       * SANS « du parc » : le locataire ne voit que les siennes, et un filtre
       * d'origine restreint encore. Un nom de liste ne promet pas plus que ce
       * que la liste porte au moment où on l'entend.
       */
      listLabel: 'Interventions',
      quote: 'Chiffrer',
      reply: 'Répondre',
      /* QUI A PARLÉ, dans le fil du chantier. Le texte vient d'un humain et ne
         se traduit pas ; ces deux clés ne portent que l'habillage. */
      replyFromManager: 'Réponse de la gestion',
      replyFromTenant: 'Réponse du locataire',
      replyTitle: 'Répondre au locataire',
      replyBody: 'Votre réponse arrive dans ses notifications, rattachée au signalement {reference}.',
      /* Pluriels par clés SŒURS — `x` / `x_one` via Intl.PluralRules. L'ICU
         imbriqué n'est pas lu par ce dépôt, et une clé qui en porterait
         afficherait ses accolades telles quelles. */
      copiesDelivered: '{count} copies e-mail remises · {date}',
      copiesDelivered_one: '1 copie e-mail remise · {date}',
      copiesPartial: '{count} copies e-mail remises sur {total} tentées · {date}',
      copiesPartial_one: '1 copie e-mail remise sur {total} tentées · {date}',
      replyTo: 'Destinataire : {name}',
      /* L'OBJET DU SIGNALEMENT — voir `ReplyModal` : on répondait sans l'avoir
         sous les yeux. */
      replyAbout: 'À propos de : {titre}',
      replyLabel: 'Votre message',
      replyHint: 'Ce que vous écrivez est lu tel quel. Dites quand, et par qui.',
      replyError: 'Un message d’au moins 3 caractères est requis',
      replySend: 'Envoyer la réponse',
      replySentTitle: 'Réponse enregistrée au dossier.',
      replyDelivered: '{name} la lira dans ses notifications.',
      replyUnreachable: '{name} n’a pas de compte : il ne la lira pas. Il reste à l’appeler.',
      replyNoReporter: 'Cette intervention n’a pas de déclarant : il n’y a personne à qui répondre.',
      replyDemo: 'Démonstration : aucune réponse n’est envoyée.',
      quoteTitle: 'Chiffrer l’intervention',
      quoteOn: '{title} · {unit}',
      quoteBody: 'Le montant proposé. Le propriétaire arbitrera : vous proposez, il décide.',
      quoteAmount: 'Montant du devis',
      quoteHint: 'En unités entières, sans séparateur.',
      quoteError: 'Un montant strictement positif est requis',
      quoted_toast: 'Devis transmis · le propriétaire doit l’arbitrer',
      reopen: 'Rouvrir',
      reopened_toast: 'Intervention rouverte',
      unapprove: 'Retirer la validation',
      unapproved_toast: 'Validation retirée · le devis revient à l’arbitrage',
      approved_toast: 'Devis validé · le gestionnaire est prévenu',
      trade: 'Corps d’état',
      managerNotice:
        'Seul le propriétaire valide les devis. Vous les préparez, il tranche.',
      emptyTitle: 'Aucune intervention sur le parc',
      emptyBody:
        'Une intervention naît d’un signalement de locataire : le gestionnaire la chiffre, vous validez le devis, puis les travaux se déroulent. Tout cela se suit ici.',
      /**
       * Signalements du jeu de démonstration. Voir `WorkTitleKey` : dans le
       * produit réel ce champ porte la saisie du locataire et ne se traduit
       * pas — ces cinq lignes ne sont la saisie de personne.
       */
      samples: {
        sinkLeak: 'Fuite sous l’évier de la cuisine',
        waterHeaterBreaker: 'Disjoncteur qui saute au démarrage du chauffe-eau',
        livingRoomPaint: 'Peinture du séjour à reprendre',
        safetyValve: 'Remplacement du groupe de sécurité',
        fullRefurbishment: 'Réfection complète avant relocation',
        /* Le SECOND signalement du locataire de la démonstration, encore ouvert.
           Un titre à lui : réutiliser celui d'un autre logement ferait paraître
           chez lui la déclaration d'un voisin, et c'est ce que la garde
           d'isolement de cet écran surveille — elle a rougi pour le dire. */
        frontDoorLock: 'Serrure de la porte d’entrée qui accroche',
      },
    },

    deposits: {
      title: 'Cautions',
      subtitle: 'Montant consigné, retenues justifiées, solde restitué.',
      // Affiché quand la caution n'est plus rattachée à personne.
      formerTenant: 'Ancien locataire',
      /* Voir `works.status` : une famille dédiée se garde, une famille partagée ne
         se garde pas. Ces trois-là viennent de `DepositStatus`. */
      status: {
        held: 'Consignée',
        settling: 'En cours d’arbitrage',
        returned: 'Restituée',
      },
      /* « Toutes » et non le « Tous » des paiements : une caution est
         féminine, et reprendre la clé d'un autre écran importait son genre. */
      filterAll: 'Toutes',
      amountHeld: 'Consigné',
      withheld: 'Retenu',
      balance: 'À restituer',
      totalHeld: 'Total consigné',
      alreadyReturned: 'Déjà restituées',
      /* Les TITRES DE SECTION de l'état des cautions. Distincts des libellés
         de statut ci-dessus, qui qualifient UNE caution : voir
         `SECTION_DE_STATUT` dans `documentsPdf`. */
      sectionHeld: 'Cautions consignées',
      sectionSettling: 'Cautions en cours d’arbitrage',
      sectionReturned: 'Cautions restituées',
      alreadyReturned_one: 'Déjà restituée',
      /* Les trois cartes étaient NUES — un intitulé, un montant, rien dessous —
         quand celles des cinq autres écrans portent une ligne qui dit sur quoi
         le montant porte. « 1 226 000 FCFA » ne disait pas sur combien de
         cautions. */
      kpiHeldNote: 'sur {count} cautions',
      kpiHeldNote_one: 'sur {count} caution',
      kpiWithheldNote: '{count} en cours d’arbitrage',
      kpiWithheldNote_one: '{count} en cours d’arbitrage',
      /* LE TERME QUI MANQUE À LA SOUSTRACTION DU PIED, et le signe en fait
         partie : « 250 000 FCFA déjà restituée » se lirait comme une part du
         total au-dessus, alors qu'il en a été retiré. */
      footReturned: '− {amount} déjà restituées',
      footReturned_one: '− {amount} déjà restituée',
      kpiBalanceNote: '{count} déjà restituées · {amount}',
      kpiBalanceNote_one: '{count} déjà restituée · {amount}',
      settle: 'Arbitrer',
      settleTitle: 'Arbitrer la caution',
      settleDescription:
        'Le locataire reçoit le détail des retenues et le solde restitué. Il peut les contester.',
      withheldAmount: 'Montant retenu',
      withheldHint: 'Laissez à zéro pour restituer l’intégralité de la caution.',
      justification: 'Justification des retenues',
      justificationHint:
        'Elle figure sur le décompte remis au locataire — citez les réserves de l’état des lieux de sortie.',
      balanceToReturn: 'Solde à restituer',
      confirmSettle: 'Valider l’arbitrage',
      unsettle: 'Défaire l’arbitrage',
      unsettled_toast: 'Arbitrage défait · la caution redevient retenue',
      emptyTitle: 'Aucune caution consignée',
      emptyBody: 'Le montant se saisit à la création de la fiche locataire. Il apparaîtra ici, avec les retenues justifiées et le solde à restituer.',
      settled: 'Caution arbitrée · décompte envoyé au locataire',
      errorTooHigh: 'La retenue ne peut pas dépasser la caution consignée, soit {amount}.',
      errorJustification: 'Justifiez la retenue : le locataire peut la contester.',
      managerNotice:
        'Seul le propriétaire arbitre les cautions. Vous préparez le décompte, il le valide.',
    },

    decisions: {
      title: 'Registre des décisions',
      subtitle: 'Ce que le parc a écrit, et qui l’a écrit.',
      empty: 'Aucune décision enregistrée pour l’instant.',
      emptyHint:
        'Les validations de devis, arbitrages de caution, encaissements et corrections s’inscrivent ici au fur et à mesure.',
      failed: 'Le registre n’a pas pu être lu.',
      colWhen: 'Quand',
      colWhat: 'Décision',
      colWho: 'Par qui',
      /* AUCUN NOM DU TOUT — les décisions d'avant la conservation du nom.
         « Compte supprimé » y est la seule chose vraie qu'on puisse dire. */
      unknownActor: 'Compte supprimé',
      /* LE NOM EST LÀ, ET SON COMPTE N'EST PLUS. Dit sous le nom, jamais à sa
         place : on écrirait sinon à quelqu'un qui n'a plus de boîte. */
      actorGone: 'Compte supprimé depuis',
      singleActor: 'Toutes les décisions affichées ont été écrites par {name}.',
      singleActorUnknown: 'Toutes les décisions affichées ont été écrites par un compte supprimé.',
      /* UN ACTE SANS COMPTE N'EST PLUS FORCÉMENT UN ACTE DONT LE COMPTE EST
         PARTI. Depuis que le produit appelle les loyers seul, le registre porte
         des lignes que personne n'a cliquées — et « compte supprimé » en
         parlerait comme d'un départ. Le libellé nomme le réglage, pas une
         machine : c'est le propriétaire qui l'a allumé. */
      systemActor: 'Appel automatique',
      singleActorSystem:
        'Toutes les décisions affichées ont été posées par l’appel automatique, sans clic.',
      more: 'Voir les décisions plus anciennes',
      /*
        LE DICTIONNAIRE ÉPOUSE L'ESPACE DE NOMS DES ACTIONS, et ce n'est pas
        un choix de rangement : `t` découpe sa clé sur les POINTS. Écrites à
        plat — `'deposit.settle'` — les clés étaient introuvables, et l'écran
        rendait « Décision enregistrée » pour toutes. Imbriquées, la clé du
        serveur devient le chemin du dictionnaire sans conversion.
      */
      units: {
        buildings: '{count} immeubles',
        buildings_one: '{count} immeuble',
        homes: '{count} logements',
        homes_one: '{count} logement',
        exclusions: '{count} exclusions',
        exclusions_one: '{count} exclusion',
        reminders: '{count} relances',
        reminders_one: '{count} relance',
        findings: '{count} constats',
        findings_one: '{count} constat',
        charges: '{count} échéances',
        charges_one: '{count} échéance',
      },
      utilities: {
        water: 'Eau',
        power: 'Électricité',
      },
      actions: {
        access: {
          link: 'Fiche locataire reliée à un compte',
          unlink: 'Fiche locataire déliée de son compte',
          revoke: 'Accès repris',
          /* CONFIER OU REPRENDRE DES IMMEUBLES. Un seul libellé pour les deux
             sens : le registre porte la LISTE dans sa charge utile, et écrire
             « périmètre élargi » ou « restreint » demanderait de comparer avec
             l'état d'avant, que le journal ne conserve pas. Le fait consigné
             est le périmètre POSÉ, pas son écart avec le précédent. */
          scope: 'Périmètre d’immeubles confié',
          /* DEUX LIBELLÉS pour les deux sens, contrairement à `scope` juste
             au-dessus : le sens d'une décision ne se lit dans aucune charge
             utile, et une action sans recette de détail n'affiche que son
             libellé. Un seul libellé rendrait le registre incapable de dire
             si la porte s'est ouverte ou fermée. */
          grant: 'Demande d’accès accordée',
          refuse: 'Demande d’accès refusée',
          /* DISTINCT de `grant` : un bouton pressé dans le registre et un code
             consommé sont deux gestes. Les confondre empêcherait de répondre à
             « comment est-il entré ? », qui est la question qu'un journal
             d'accès existe pour trancher. */
          join: 'Entrée par code d’invitation',
        },
        /* SUPPRIMER UN IMMEUBLE. Le nom est dans la charge utile parce
           qu'après coup il ne reste rien d'autre : l'identifiant ne mène plus
           nulle part. */
        building: {
          delete: 'Immeuble supprimé',
          /* CORRIGÉ, ET NON « MODIFIÉ ». Cette route ne touche qu'au nom et au
             quartier — rien qui déplace de l'argent. « Modifié » laisserait
             croire qu'un immeuble peut changer de nature ; « corrigé » dit le
             geste réel, réparer une saisie. */
          update: 'Immeuble corrigé',
        },
        deposit: {
          settle: 'Caution arbitrée',
          unsettle: 'Arbitrage de caution repris',
        },
        /* `declined` ET NON `refused` : le serveur compose son action depuis
           `DocumentRequestStatus`, dont la valeur est `declined`. Le mot avait
           été traduit une fois de trop — on écrivait `declined` en base et on
           l'avait nommé `refused` ici, si bien que TOUTE demande de pièce
           refusée s'inscrivait au registre sous « Action inconnue ». */
        document: {
          fulfilled: 'Pièce remise',
          declined: 'Demande de pièce refusée',
          /* « RETIRÉE » ET NON « SUPPRIMÉE », parce que c'est ce que la route
             fait : elle efface les octets du stockage PUIS la ligne, dans la même
             transaction. Le registre, lui, garde la trace — dire « supprimée »
             ferait croire que rien n'en reste, alors que la demande de pièce
             survit et redevient à fournir. */
          file_delete: 'Pièce retirée',
        },
        inspection: {
          record: 'État des lieux établi',
          photo: 'Photo versée au dossier',
          photo_delete: 'Photo retirée du dossier',
        },
        lease: {
          formal_notice: 'Mise en demeure signifiée',
          /* TROIS ACTES DE PLUS, et aucun ne se déduit d'un autre : « bail
             modifié » aurait laissé indécidable si un congé est arrivé, s'il a
             été retiré, ou si le loyer a changé — trois faits aux conséquences
             opposées sur la vacance et sur l'encaissement. */
          notice: 'Congé enregistré',
          notice_withdraw: 'Congé retiré',
          revise_rent: 'Loyer révisé',
          settlement_plan: 'Plan d’apurement convenu',
          settlement_close: 'Plan d’apurement clos',
          charge_line_added: 'Charge convenue au bail',
          charge_line_removed: 'Charge retirée du bail',
          charge_settlement: 'Décompte de charges arrêté',
        },
        park: {
          update: 'Parc corrigé',
        },
        listing: {
          open: 'Annonce ouverte',
          status: 'État d’annonce changé',
        },
        applicant: {
          status: 'Suite donnée à un candidat',
        },
        payment: {
          proof_delete: 'Preuve de paiement retirée',
          record: 'Encaissement saisi',
          delete: 'Encaissement retiré',
        },
        receipt: {
          issued: 'Quittance émise',
        },
        rent: {
          call: 'Appel de loyers émis',
          remind: 'Relance envoyée',
        },
        /* LE RELEVÉ AU REGISTRE, et il y a sa place : un index conteste. Le
           locataire qui trouve sa refacturation trop haute demande QUEL index a
           été lu, QUAND et par qui — et c'est la seule ligne qui le dise. */
        reading: {
          record: 'Relevé de compteur saisi',
          /* TROIS LIBELLÉS DISTINCTS. Le sens du geste ne se lit dans aucune
             charge utile : « relevé modifié » ne dirait pas si l'index a été
             réparé ou si la ligne a disparu — et c'est la première question
             qu'on pose au registre quand une refacturation est contestée. */
          update: 'Relevé de compteur corrigé',
          delete: 'Relevé de compteur retiré',
        },
        /* LA DÉPENSE — trois libellés et non un. Comme pour les tarifs, une
           ligne qui dirait seulement « dépense modifiée » laisserait indécidable
           si un montant a été réparé ou si la ligne a disparu du résultat. */
        /* LE BARÈME D'HONORAIRES — deux libellés. Comme pour les tarifs, une
           ligne qui dirait seulement « honoraires modifiés » laisserait
           indécidable si un taux a été réparé ou si le barème a disparu, et
           c'est la question qu'on vient poser au registre quand un net reversé
           change sans qu'aucun loyer n'ait bougé. */
        fee: {
          set: 'Barème d’honoraires posé',
          delete: 'Barème d’honoraires retiré',
        },
        /* ARRÊTER LE COMPTE D'UNE PÉRIODE. Le libellé nomme le DOCUMENT et sa
           période, pas le calcul : ce qui se décide ici est qu'un relevé cesse
           de suivre les lignes du parc. La charge porte le net, que la recette
           de détail affiche — un compte-rendu dont on ne lit pas le net oblige
           à rouvrir la boîte pour savoir ce qui a été arrêté. */
        statement: {
          issue: 'Compte-rendu de gestion émis',
        },
        guarantor: {
          add: 'Garant ajouté',
          remove: 'Garant retiré',
        },
        expense: {
          record: 'Dépense saisie',
          update: 'Dépense corrigée',
          delete: 'Dépense retirée',
        },
        tariff: {
          set: 'Tarif de refacturation posé',
          /* CORRIGÉ ET RETIRÉ, deux libellés et non un. Le sens d'une décision
             ne se lit dans aucune charge utile — une ligne qui dirait seulement
             « tarif modifié » laisserait indécidable si le prix a été réparé ou
             si la ligne a disparu, et c'est justement ce qu'on vient chercher
             au registre quand une refacturation passée ne s'explique plus. */
          update: 'Tarif de refacturation corrigé',
          delete: 'Tarif de refacturation retiré',
        },
        /* LE LOGEMENT CORRIGÉ, et le registre montre son NUMÉRO : « B2 » dit
           lequel, là où l'identifiant ne dirait rien. Le loyer de RÉFÉRENCE
           suit, parce que c'est le seul champ de cette correction qui porte de
           l'argent — et parce qu'il n'a justement PAS réécrit les échéances,
           ce qu'un lecteur doit pouvoir vérifier. */
        unit: {
          update: 'Logement corrigé',
          delete: 'Logement retiré',
        },
        tenant: {
          create: 'Fiche de locataire ouverte',
          delete: 'Fiche de locataire retirée',
          update: 'Fiche de locataire corrigée',
        },
        work: {
          quote: 'Devis chiffré',
          approve: 'Devis validé',
          unapprove: 'Validation de devis reprise',
          complete: 'Chantier soldé',
          reopen: 'Chantier rouvert',
        },
        unknown: 'Décision enregistrée',
      },
    },
    access: {
      title: 'Accès au parc',
      subtitle: 'Qui détient une clé, et quels codes attendent encore d’être utilisés.',
      managerNotice:
        'Seul le propriétaire retire un accès. Vous voyez le registre et reprenez les codes de locataire.',
      membersTitle: 'Membres',
      membersHint: 'Les personnes qui accèdent au parc aujourd’hui.',
      /* Le registre comptait ses membres et ses invitations sans jamais les
         écrire : pour savoir combien de personnes ont une clé, il fallait
         compter les lignes à l'œil. */
      kpiMembers: 'Personnes avec un accès',
      kpiMembersNote: 'vous compris',
      kpiInvitations: 'Codes en attente',
      kpiInvitationsNote: 'pas encore utilisés',
      member: 'Personne',
      /* LE TRI DU REGISTRE. « Tous » au masculin : un MEMBRE, et non une
         personne — le mot que l'écran emploie partout. */
      filterRole: 'Trier par rôle',
      filterAll: 'Tous',
      memberRole: 'Rôle',
      since: 'Membre depuis',
      action: 'Action',
      role_owner: 'Propriétaire',
      role_manager: 'Gestionnaire',
      role_tenant: 'Locataire',
      /* CE QUE CE COMPTE DÉTIENT, nommé sur sa rangée. L'écart entre le nom du
         compte et celui de la fiche est le SEUL signe visible d'un lien posé
         sur la mauvaise personne — relevé sur la production. */
      holdsRecord: 'Détient la fiche {fiche} · {unit}',
      unlinkTenant: 'Délier la fiche',
      /* LES NOMS QUI DIVERGENT. Une QUESTION, jamais un verdict : un nom
         d'épouse, une société qui loue pour un salarié, un diminutif. */
      nameMismatch: 'Le nom ne correspond pas',
      /* CONFIER UN IMMEUBLE. Le libellé CONSTATE, il ne reproche pas : c'est
         le propriétaire qui décide de restreindre.
         CE COMMENTAIRE DISAIT « l'état par défaut d'un gestionnaire », ET C'EST
         DEVENU FAUX : depuis que l'adhésion naît `declared`, le défaut est de
         ne RIEN voir. « Tout le parc » ne vaut plus que pour les adhésions
         d'avant. Voir `scopeNothing`, sa jumelle. */
      scopeAll: 'Gère tout le parc',
      /* L'ÉTAT DE NAISSANCE, et le plus fréquent des deux. Il se dit, parce que
         le registre est le seul écran d'où le propriétaire peut s'apercevoir
         qu'il n'a encore rien confié — et qu'il y lisait jusqu'ici l'inverse. */
      scopeNothing: 'Rien ne lui est encore confié',
      /* Le compte du RESTE, et par clés sœurs : « et 1 autre » ne se dit pas
         « et 1 autres ». */
      scopeMore: 'et {count} autres',
      scopeMore_one: 'et 1 autre',
      /* LA QUEUE DE PHRASE, pour les seuls retranchés qui ne peuvent
         s'attacher à aucun immeuble confié — voir `scopeBuildingExcept`. */
      scopeExcept: '— sauf {names}',
      /* L'EXCEPTION COLLÉE À SON IMMEUBLE. Rejetée en fin de phrase, elle
         renommait l'immeuble de l'autre côté de « sauf » et se lisait comme son
         retrait. Les parenthèses la subordonnent au lieu de la juxtaposer. */
      scopeBuildingExcept: '{name} (sauf {units})',
      scopeSome: 'Gère : {names}',
      scopeAction: 'Confier des immeubles',
      /* LES DEMANDES, À PART DES MEMBRES : rangée parmi eux, une demande se
         lirait comme un accès déjà accordé, sur l'écran qui sert à décider. */
      requestsTitle: 'Demandes d’accès',
      requestsBody: 'Ces comptes demandent à gérer ce parc. Accorder ouvre l’accès sans rien confier : vous choisirez ensuite les immeubles.',
      grant: 'Accorder',
      refuse: 'Refuser',
      granted: 'Accès accordé · rien ne lui est encore confié',
      refused: 'Demande refusée',
      scopeTitle: 'Immeubles confiés à {name}',
      scopeBody: 'Ce gestionnaire ne verra que les immeubles cochés : leurs baux, leurs loyers et leurs cautions.',
      scopeEmptyMeansAll: 'Aucune case cochée lui rend le parc entier. C’est ainsi qu’on défait une délégation.',
      scopeSave: 'Confier',
      scopeSaved: 'Périmètre enregistré',
      linkMismatch:
        'Le compte de {compte} et la fiche de {fiche} ne portent pas le même nom. Vérifiez qu’il s’agit bien de la même personne : ce compte verra ce bail, ses quittances et ses relevés.',
      unlinkTitle: 'Délier la fiche de {name} ?',
      unlinkBody: 'Ce compte perdra aussitôt l’accès au bail, aux quittances et aux relevés qu’il consultait. La fiche redevient libre : vous pourrez la relier au bon compte.',
      unlinkBodyNamed: 'Ce compte détient la fiche {fiche} · {unit}. Il perdra aussitôt l’accès à ce bail, à ses quittances et à ses relevés. La fiche redevient libre : vous pourrez la relier au bon compte.',
      unlinked: 'Fiche déliée · elle peut être reliée au bon compte',
      linkTenant: 'Relier à une fiche',
      linkTitle: 'Relier {name} à sa fiche locataire',
      linkBody: 'Ce compte accède au parc sans être rattaché à un bail : son espace reste vide. Choisissez la fiche qui lui correspond.',
      linkField: 'Fiche locataire',
      linkHint: 'Le logement est rappelé après le nom : c’est lui qui distingue deux fiches homonymes.',
      linked: 'Fiche reliée · le locataire voit désormais son logement',
      /* LE NOM DE LA PERSONNE OU DU LOGEMENT DANS LE NOM ACCESSIBLE — voir
         `Meters.correctLine`, qui a écrit la règle : « douze boutons "Corriger" à
         la suite ne disent pas lequel on active ». Ces libellés-ci ne s'affichent
         jamais : le bouton garde son mot court, et seule la voix reçoit le
         complément. */
      revokeMemberFor: 'Retirer l’accès de {name}',
      linkTenantFor: 'Relier à une fiche — {name}',
      unlinkTenantFor: 'Délier la fiche — {name}',
      revokeMember: 'Retirer l’accès',
      memberRevoked: 'Accès retiré',
      invitesTitle: 'Codes en attente',
      invitesHint:
        'Un code vaut quatorze jours et ne sert qu’une fois. Reprenez celui que vous avez transmis par erreur.',
      code: 'Code',
      expires: 'Expire',
      expired: 'Périmé',
      noUnit: 'Sans logement rattaché',
      revokeInvite: 'Reprendre',
      inviteRevoked: 'Code repris — il n’ouvre plus rien',
      noInvites: 'Aucun code en attente',
      noInvitesBody:
        'Les codes déjà utilisés, repris ou périmés ne figurent pas ici : cette liste ne montre que ce qui ouvre encore.',
      noParkTitle: 'Aucun parc rattaché à cette session',
      noParkBody:
        'Le registre des accès appartient à un parc. Créez le vôtre, ou rejoignez celui d’un propriétaire avec le code qu’il vous a transmis.',
      loadFailedTitle: 'Impossible de lire le registre des accès',
      loadFailedBody:
        'Personne n’a été retiré et aucun code n’a été repris. Cette page ne sait pas qui détient une clé : ne la lisez pas comme une liste vide.',
      confirmMemberTitle: 'Retirer l’accès de {name} ?',
      confirmMemberBody:
        'Cette personne perd l’accès au parc immédiatement. Pour la faire revenir, il faudra lui émettre un nouveau code.',
      confirmInviteTitle: 'Reprendre le code qui finit par {hint} ?',
      confirmInviteBody:
        'Le code cesse d’ouvrir, y compris entre les mains de celui à qui vous l’avez transmis. Il ne se réémet pas : vous en créerez un autre.',
    },
    announce: {
      button: 'Prévenir les locataires',
      title: 'Message aux locataires',
      description: 'Un message à tous les locataires en place. Les baux terminés ne sont pas concernés.',
      scope: 'Destinataires',
      scopeHint: 'Tout le parc, ou les seuls locataires d’un immeuble.',
      scopeAll: 'Tout le parc',
      message: 'Votre message',
      messageHint: 'Il est lu tel quel, sans mise en forme. Dites quoi, quand, et pour combien de temps.',
      error: 'Un message d’au moins 3 caractères est requis',
      send: 'Envoyer',
      sentTitle: 'Message envoyé.',
      delivered: '{count} locataires le liront dans leurs notifications.',
      delivered_one: '{count} locataire le lira dans ses notifications.',
      /* COMBIEN LIRONT, AVANT DE CLIQUER — voir `AnnounceModal` : le compte ne
         se disait qu'APRÈS l'envoi, quand il décide de ce qu'on écrit. */
      audience: '{count} locataires le recevront.',
      audience_one: '{count} locataire le recevra.',
      unreachable: '{count} locataires n’ont pas de compte : il reste à les appeler.',
      unreachable_one: '{count} locataire n’a pas de compte : il reste à l’appeler.',
      channelNotice: 'Le message se dépose dans l’application. Aucun SMS n’est envoyé.',
      demo: 'Démonstration : aucun message n’est envoyé.',
    },
    invite: {
      button: 'Inviter par code',
      title: 'Inviter à rejoindre le parc',
      description: 'Le code s’affiche une seule fois. Transmettez-le à la personne concernée.',
      role: 'Rôle invité',
      roleTenant: 'Locataire',
      roleManager: 'Gestionnaire délégué',
      /* CE QU'ON DÉLÈGUE, dit avant le clic. Le champ du logement disparaît
         sur ce rôle et rien ne disait pourquoi : le propriétaire croyait
         confier UN logement, il confie tout son parc. */
      managerScope:
        'Il ne verra rien tant que vous ne lui aurez rien confié : des immeubles, des logements, ou tout le parc — cela se règle dans « Accès au parc », après son arrivée. Il ne peut ni approuver un devis, ni arbitrer une caution, ni recruter un autre gestionnaire — ces trois décisions restent les vôtres.',
      /* UN SEUL CODE VIVANT PAR LOGEMENT, et on le dit au lieu de faire
         disparaître une ligne du menu sans explication. */
      unitTakenNotice:
        'Un code attend déjà pour {units} : un logement n’en porte qu’un à la fois. Reprenez-le avant d’en émettre un autre.',
      unitTakenAction: 'Voir les codes en attente',
      managerNotice:
        'Seul le propriétaire recrute un gestionnaire. Vous invitez des locataires.',
      unitNone: 'Aucun logement pour l’instant',
      unitVacant: 'vacant',
      unit: 'Logement concerné',
      unitHint:
        'Le locataire rejoindra ce logement. Sans logement, il rejoint le parc sans bail — vous l’y rattacherez ensuite.',
      /* LE DESTINATAIRE DU CODE, AVANT DE L'ÉMETTRE — voir `InviteModal`. Le
         panneau du code promet « Envoyé par SMS au numéro indiqué » sans que
         ce numéro ait jamais paru, et une fiche sans téléphone ne déclenche
         aucun envoi. */
      unitHintPhone: 'Le code partira par SMS au {phone}.',
      unitHintNoPhone:
        'Cette fiche n’a pas de téléphone : aucun SMS ne partira, transmettez le code vous-même.',
      issue: 'Émettre le code',
      codeTitle: 'Code d’invitation',
      codeOnce:
        'Notez-le maintenant : il n’est plus lisible ensuite, même par vous. En cas de perte, émettez-en un autre.',
      sentBySms: 'Envoyé par SMS au numéro indiqué.',
      notSent: 'Aucun SMS n’a été envoyé : transmettez le code vous-même.',
      expires: 'Valable 14 jours.',
      copy: 'Copier',
      copied: 'Code copié',
    },
    tenants: {
      title: 'Locataires et baux',
      subtitle: 'Chaque locataire est rattaché à une unité par un bail actif.',
      /**
       * LA RANGÉE D'INDICATEURS QUI MANQUAIT À CET ÉCRAN.
       *
       * Il comptait déjà les trois : les baux, le loyer qu'ils portent, les
       * demandes de pièces en attente. `vacant` ne servait qu'à griser un
       * bouton, `demandesEnAttente` qu'à décider d'afficher une carte. On
       * arrivait sur un tableau de dix lignes sans un seul nombre, quand les
       * six écrans voisins ouvrent sur une rangée de cartes.
       */
      kpiLeases: 'Baux actifs',
      kpiLeasesNote: '{count} logements vacants',
      kpiLeasesNote_one: '{count} logement vacant',
      kpiRent: 'Loyer mensuel',
      kpiRentNote: 'appelé sur les baux actifs',
      kpiRequests: 'Pièces demandées',
      kpiRequestsNote: 'en attente de votre réponse',
      addTenant: 'Créer une fiche locataire',
      /* L'ÉTAT QUE DEUX ÉCRANS SE CACHAIENT L'UN À L'AUTRE. Le statut du bail
         ne dit rien de l'accès : à jour et sans espace où le lire. */
      noAccount: 'Sans compte',
      /* LES LIBELLÉS DE LA FICHE DE LOCATAIRE. DEUX faits, deux gestes, et les
         noms accessibles du menu : douze entrées « Corriger » ne disent pas
         laquelle on active.

         `cardDeposit` ET `cardWorks` SONT PARTIS AVEC LEURS COLONNES. La fiche
         ne porte plus quatre faits dont deux affichaient un tiret huit fois sur
         dix : la caution et les chantiers sont devenus des pastilles
         conditionnelles, et elles empruntent les clés de la fiche de LOGEMENT
         — `app.portfolio.depositHeld`, `app.portfolio.openWorks` —, qui disent
         la même chose sur l'écran Parc. Deux écrans, un seul vocabulaire. Une
         chaîne traduite que plus rien ne rend est un orphelin ; celles-ci sont
         retirées plutôt que gardées « au cas où ». */
      remindOne: 'Relancer',
      remindFor: 'Relancer {name}',
      fileLinkFor: 'Dossier — {unit}',
      fileLink: 'Dossier',
      actionsFor: 'Actions pour {name}',
      editFor: 'Corriger la fiche de {name}',
      removeFor: 'Retirer la fiche de {name}',
      removeBlocked: 'Seul le propriétaire peut retirer une fiche',
      searchLabel: 'Rechercher un locataire, un logement ou un numéro',
      searchShort: 'Nom, logement…',
      searchEmpty: 'Aucun locataire ne correspond.',
      searchEmptyHint: 'Essayez un nom, un numéro de logement ou un téléphone — ou revenez à « Tous ».',
      resetFilters: 'Effacer les filtres',
      /* L'ACCORD SUIT LA CONVENTION DU DÉPÔT — `x` et `x_one`, `Intl.PluralRules`
         choisissant la variante — et NON l'ICU imbriqué, que `t()` ne sait pas
         lire. Écrit en ICU, ce message s'affichait TEL QUEL sur l'écran des
         locataires, accolades comprises. Vu au navigateur ; le cas jsdom, lui,
         cherchait une sous-chaîne qui existe aussi dans le message cassé. */
      noAccountNotice:
        '{count} locataires n’ont pas de compte : ils ne voient ni bail, ni quittance, ni relevé, et ne reçoivent aucune annonce. Reliez leurs fiches depuis le registre des accès.',
      noAccountNotice_one:
        '{count} locataire n’a pas de compte : il ne voit ni bail, ni quittance, ni relevé, et ne reçoit aucune annonce. Reliez sa fiche depuis le registre des accès.',
      noAccountAction: 'Relier depuis « Accès au parc »',
      /* LE CHAMP QUI EMPÊCHE L'ORPHELIN. Il ne paraît que s'il y a quelqu'un à
         relier — un menu vide sur chaque création serait un champ qui ne mène
         nulle part, sur la modale la plus utilisée de l'écran. */
      account: 'Compte du locataire',
      accountHint: 'S’il est déjà entré dans le parc par un code, reliez sa fiche maintenant : son espace s’ouvrira aussitôt, sans autre geste.',
      accountNone: 'Aucun — il n’a pas encore de compte',
      leaseStart: 'Début du bail',
      leaseStartHint: 'Laissez vide pour aujourd’hui. Renseignez la vraie date pour un locataire déjà en place.',
      deposit: 'Caution encaissée',
      depositHint: 'Laissez vide si vous ne la retrouvez pas : mieux vaut rien qu’un chiffre inventé.',
      leaseRent: 'Loyer du bail',
      leaseRentHint: 'Laissez vide pour reprendre le loyer de référence du logement.',
      modalTitle: 'Nouvelle fiche locataire',
      /**
       * TROIS FOIS la même promesse, et pas une tenue.
       *
       * Un code d’invitation parti par SMS : annoncé à l’ouverture de la modale,
       * répété sous le champ du téléphone, confirmé au passé dans le message de
       * succès. La route qui crée la fiche n’émet aucun code — elle écrit un
       * locataire, un bail, parfois une caution, et rien d’autre — et la
       * messagerie n’a pas de canal SMS : `envoyerSms` rend `false` sans appeler
       * personne, et le commentaire au-dessus dit pourquoi. Le bailleur croyait
       * donc son locataire prévenu, ne transmettait rien, et attendait une
       * activation qui ne pouvait pas venir.
       *
       * L’émission d’un code existe, mais sur un geste distinct — « Inviter par
       * code », deux boutons plus loin sur le même écran. C’est là qu’on renvoie,
       * et c’est le seul endroit du produit qui sache dire si quelque chose est
       * parti : `InviteModal` lit la réponse du serveur avant de l’affirmer.
       */
      modalDescription:
        'La fiche rattache le locataire à son logement. Pour lui ouvrir son espace, émettez ensuite un code depuis « Inviter par code ».',
      created: 'Fiche locataire créée',
      phoneHint: 'Pour l’appeler depuis sa fiche. Aucun message ne part d’ici.',
      since: 'Locataire depuis',
      /* LA COLONNE NOMME SON AXE, et elle ne le faisait pas. « Statut » est un
         libellé partagé par neuf écrans — cautions et quittances compris. Sur
         celui-ci, dont la bannière parle de COMPTES et dont une ligne porte un
         badge « Sans compte », « En attente » a été lu « en attente d'un
         compte ». Le lecteur n'a pas mal lu : la page ne disait pas de quoi. */
      /* « CE MOIS » ET NON « LOYER DU MOIS » : treize caractères passaient sous la
         colonne de gestes ÉPINGLÉE et se coupaient — « LOYER DU MC » sur une
         capture de production. Les en-têtes portent `whitespace-nowrap`, donc ils
         se rognent au lieu de se replier, et aucune règle de débordement ne le
         voit : le texte reste dans sa boîte.
         L'AXE RESTE NOMMÉ. La colonne voisine s'appelle « Loyer » ; « Ce mois »
         la suit sans la répéter, et c'est ce qui manquait à « Statut ». */
      rentStatus: 'Ce mois',
      contact: 'Contact',
      /* CORRIGER une fiche : le geste qui manquait. Une coquille dans un nom ou
         un numéro n'avait aucun chemin — supprimer pour recréer emporte le bail,
         et se referme au premier versement encaissé. */
      /* FACULTATIF, et l'aide dit ce qu'il DÉBLOQUE plutôt que ce qu'il est. */
      email: 'Adresse électronique',
      emailHint: 'Pour lui écrire tant qu’il n’a pas de compte : réponses à ses signalements et annonces du parc.',
      edit: 'Corriger',
      editTitle: 'Corriger la fiche de {name}',
      editBody: 'Le nom et le numéro seulement. Le loyer et le logement s’arbitrent depuis le bail ; le compte, depuis « Accès au parc ».',
      editName: 'Nom complet',
      editPhone: 'Téléphone',
      editPhoneHint: 'Au format international, indicatif compris. Laissez vide pour retirer le numéro.',
      editSave: 'Enregistrer',
      editSaved: 'Fiche corrigée',
      editNameInvalid: 'Deux caractères au moins',
      remove: 'Retirer',
      removeTitle: 'Retirer la fiche de {name} ?',
      removeBody: 'Le bail et les échéances appelées partent avec elle ; le logement redevient vacant. Refusé si un versement a été encaissé ou une caution détenue — retirez-les d’abord.',
      removeUnit: 'Logement {unit}',
      removed: 'Fiche retirée · le logement est vacant',
      vacantTitle: '{count} logements vacants',
      vacantTitle_one: '{count} logement vacant',
      vacantHint: 'Aucun loyer n’y est appelé tant qu’aucun locataire n’y est rattaché.',
      noVacantNotice:
        'Tout le parc est loué. Une fiche locataire a besoin d’une unité vacante à laquelle se rattacher.',
    },

    alerts: {
      title: 'Signalements et notifications',
      subtitle: 'Ce que le produit a détecté ou reçu, du plus récent au plus ancien.',
      markRead: 'Tout marquer comme lu',
      /* L'écran comptait ses non-lues et les rendait dans un paragraphe gris.
         Le compte le plus utile de la page vivait en prose, sous l'en-tête,
         quand ses six voisins ouvrent sur une rangée de cartes. */
      kpiUnread: 'Non lues',
      filterAll: 'Toutes',
      filterPriority: 'Prioritaires',
      kpiUnreadNote: 'sur {count} notifications',
      kpiUnreadNote_one: 'sur {count} notification',
      kpiRead: 'Déjà lues',
      kpiReadNote: 'rien à faire dessus',
      /**
       * Le RANG d'une relance, et si elle est partie.
       *
       * « Relance envoyée à Serge Mbarga » ne disait ni la combientième c'était,
       * ni si le message avait quitté le produit. Deux manques distincts : le
       * premier fait relancer une cinquième fois sans le savoir, le second fait
       * croire qu'un locataire a été prévenu alors que rien n'est parti.
       */
      rank: 'Rappel n° {n}',
      rankOfSeries: 'Rappel n° {n} sur {total}',
      seriesNoneSent: 'Aucune n’est encore partie · visibles ici seulement',
      seriesDispatch: '{sent} partie(s), la dernière le {date} · {waiting} en attente',
      sentOn: 'Parti par {channel} le {date}',
      /* « Pas encore parti » et non le silence : une relance qui n'a pas quitté
         le produit est une relance que le locataire n'a pas reçue, et c'est
         précisément ce que le bailleur doit savoir avant de s'étonner. */
      notSent: 'Pas encore parti · visible ici seulement',
      channel_in_app: 'l’application',
      channel_email: 'e-mail',
      channel_sms: 'SMS',
      allRead: 'Toutes les notifications sont lues.',
      unreadMark: 'Non lue',
      empty: 'Rien à signaler sur le parc.',
      emptyBody:
        'Le produit dépose ici les loyers en retard, les devis à arbitrer, les relevés manquants et les baux qui arrivent à échéance. Rien de tout cela n’est en cours.',
      open: 'Ouvrir',
      /* LE NOM ACCESSIBLE du même bouton — voir le bloc qui le pose. */
      openKind: 'Ouvrir · {kind}',
      unread: '{count} non lues',
      unread_one: '{count} non lue',
      severityHigh: 'Prioritaire',
      severityMedium: 'À suivre',
      severityLow: 'Pour information',
      kind: {
        payment: 'Paiement',
        work: 'Travaux',
        meter: 'Relevé',
        lease: 'Bail',
        /* CES DEUX-LÀ MANQUAIENT, et l'écran affichait leur CLÉ en toutes
           lettres — `app.alerts.kind.announcement`. Les journaux de test le
           disaient depuis longtemps, en avertissement que rien ne lisait. */
        announcement: 'Annonce',
        access: 'Accès',
      },
      msg: {
        /**
         * UNE DEMANDE D'ACCÈS QUI ATTEND UNE DÉCISION.
         *
         * Les autres avis racontent un fait ; celui-ci RÉCLAME. Le détail
         * nomme donc l'écran où l'on tranche — sans quoi le propriétaire sait
         * qu'on lui demande quelque chose et pas où répondre.
         *
         * LE NOM SEUL, jamais l'adresse : elle est déjà dans le registre, et
         * une liste d'avis se lit par-dessus l'épaule.
         */
        accessRequested: {
          title: 'Demande d’accès · {name}',
          detail: 'Ce compte demande à gérer votre parc. Accordez ou refusez depuis le registre des accès.',
        },
        /**
         * LE SIGNALEMENT D'UN LOCATAIRE, et il n'arrivait nulle part.
         *
         * `workReply` descend — la réponse du gestionnaire au locataire. Le
         * sens MONTANT manquait : l'écran « Signaler » promet que le bailleur
         * reçoit immédiatement, et le bailleur lisait « Rien à signaler ».
         *
         * Le titre porte la RÉFÉRENCE, parce que c'est ce qu'on cite au
         * téléphone et ce que le locataire voit de son côté. Le texte est le
         * sien : il ne se traduit pas.
         */
        tenantReport: {
          title: 'Signalement {reference} · {unit}',
          detail: '{text}',
        },
        /**
         * LA RÉPONSE DU LOCATAIRE, qui remonte le même fil.
         *
         * Elle NE PEUT PAS partager le libellé de `workReply` : celui-ci dit
         * « Réponse à VOTRE signalement », ce qui est juste pour le locataire
         * qui la reçoit et faux pour le gestionnaire, à qui l'on annoncerait sa
         * propre réponse comme une nouvelle. Le titre nomme donc QUI a parlé.
         *
         * `{tenant}` et non le logement seul : le gestionnaire d'un immeuble
         * lit dix cartes d'affilée, et « A1 » ne lui dit pas qui l'attend
         * vendredi matin.
         */
        tenantReply: {
          title: 'Réponse de {tenant} · {unit}',
          detail: '{reference} · {text}',
        },
        rentOverdue: {
          title: 'Loyer {unit} en retard de {count} jours',
          title_one: 'Loyer {unit} en retard de {count} jour',
          detail: '{tenant} · relance partie le {date}',
        },
        /**
         * La relance : ce que le gestionnaire a FAIT, pas ce qu'il doit faire.
         *
         * `rentOverdue` dit le retard, celle-ci dit la démarche — les deux
         * cohabitent dans la liste, et les confondre ferait lire deux fois le
         * même impayé.
         */
        rentReminder: {
          /**
           * « Rappel de loyer » et non « Relance envoyée ».
           *
           * Le titre AFFIRMAIT un envoi que le produit ne fait pas : le
           * fournisseur de messagerie qui tourne aujourd'hui écrit dans le
           * journal et rend toujours faux, si bien que la carte annonçait
           * « Relance envoyée à Serge Mbarga » au-dessus de « Pas encore parti ».
           * Une contradiction frontale dans les deux lignes d'une même carte,
           * vue en capture et par aucun test — ils vérifiaient chaque moitié
           * séparément.
           *
           * Le titre nomme donc ce que la ligne EST — un rappel de loyer — et
           * laisse `sentAt` dire ce qu'il est advenu. Une seule source pour
           * l'envoi, celle qui le connaît.
           */
          title: 'Rappel de loyer · {tenant}',
          detail: '{count} jours de retard · {amount} dus',
          detail_one: '{count} jour de retard · {amount} dus',
        },
        /**
         * La mise en demeure. Le détail ne parle ni de courrier ni d'accusé de
         * réception : le produit consigne, il n'expédie rien.
         */
        formalNotice: {
          title: 'Mise en demeure — {tenant}',
          detail: '{amount} dus · consignée au journal',
        },
        quotePending: {
          title: 'Devis à arbitrer',
          detail: '{workId} · {unit} · {amount} proposés par le gestionnaire',
        },
        metersMissing: {
          title: '{count} relevés manquants pour {period}',
          title_one: '{count} relevé manquant pour {period}',
          detail: '{units} · à saisir avant la facturation',
        },
        leaseRenewal: {
          title: 'Bail {unit} à renouveler dans {count} jours',
          title_one: 'Bail {unit} à renouveler dans {count} jour',
          detail: '{tenant} · échéance au {date}',
        },
        /**
         * LE DÉPART ANNONCÉ, et ce que son libellé ne dit PAS.
         *
         * Il ne dit pas « bail terminé » : un congé n'est pas une fin, le bail
         * reste actif jusqu'au départ — c'est la règle écrite par le lot
         * « congé, révision, garant ». Il nomme donc la DATE DE SORTIE.
         *
         * Le détail nomme les deux gestes que ce départ ouvre, parce que le
         * produit les possède tous les deux et qu'un avis qui ne dit pas quoi
         * faire se lit une fois puis s'ignore.
         */
        leaseMoveOut: {
          title: 'Départ de {unit} dans {count} jours',
          title_one: 'Départ de {unit} dans {count} jour',
          detail: '{tenant} · sortie le {date} · état des lieux et caution à solder',
        },
        partialPayment: {
          title: 'Règlement partiel enregistré sur {unit}',
          detail: '{tenant} · {amount} sur {total}',
        },
        announcement: {
          title: 'Message de votre bailleur',
          detail: '{text}',
        },
        workReply: {
          title: 'Réponse à votre signalement',
          detail: '{reference} · {text}',
        },
        workDone: {
          title: 'Intervention terminée',
          detail: '{workId} · {unit} · achevée le {date}',
        },
        receiptAvailable: {
          title: 'Quittance de {period} disponible',
          detail: '{unit} · règlement de {amount} enregistré',
        },
      },
    },

    /* L'ADRESSE EXISTE, ELLE N'EST PAS LA VÔTRE. « Introuvable » annonçait un
       défaut du produit pour un droit qui fonctionne. */
    otherSpace: {
      title: 'Cet écran est celui du locataire',
      body: 'Cette adresse existe, mais elle appartient à l’espace du locataire. Votre tableau de bord réunit ce qui vous concerne.',
      action: 'Revenir au tableau de bord',
    },
    noPark: {
      title: 'Aucun parc rattaché à votre compte',
      subtitle: 'Votre compte existe, mais il n’administre encore aucun bien.',
      body: 'Il n’y a rien à afficher pour l’instant',
      hint: 'Les chiffres, les logements et les échéances apparaîtront dès que votre compte sera rattaché à un parc. Tant qu’il ne l’est pas, cet espace reste vide — il ne montre jamais les données d’un autre.',
    },
    onboarding: {
      changeInSettings: 'Modifier dans les réglages du parc',
      delegationOffNotice: 'Ce parc est en gestion seule : aucun code de gestionnaire n’est émis. Changez la politique de délégation pour en recruter un.',
      joinTitle: 'Rejoindre un parc',
      joinBody: 'Si votre propriétaire ou gestionnaire vous a remis un code, saisissez-le ici : votre compte sera rattaché à son parc, au rôle qu’il vous a accordé.',
      join: 'Rejoindre',
      joined: 'Parc rejoint · votre espace est à jour',
      joinRefused: 'Ce code ne peut pas être utilisé. Vérifiez-le, ou demandez-en un nouveau.',
      /* DEMANDER SANS CODE. Le serveur répond PAREIL que l'adresse existe ou
         non — sinon la route deviendrait un détecteur de clientèle. L'écran
         ne doit donc jamais promettre plus : « transmise », jamais « reçue ». */
      requestTitle: 'Demander l’accès à un parc',
      requestBody: 'Vous n’avez pas de code ? Indiquez l’adresse e-mail du propriétaire. Votre demande apparaîtra dans son registre des accès, et c’est lui qui décidera.',
      requestEmail: 'Adresse e-mail du propriétaire',
      request: 'Envoyer la demande',
      requested: 'Demande transmise · le propriétaire décidera',
      requestFailed: 'La demande n’a pas pu être transmise. Réessayez.',
      title: 'Prise en main et délégation des droits',
      // La seconde proposition promettait d'inviter depuis cet écran, qui n'en
      // porte ni bouton ni lien.
      subtitle: 'Qui peut faire quoi, selon la façon dont vous gérez le parc.',
      delegateOn: 'Gestion déléguée',
      delegateOff: 'Vous gérez seul',
      delegateOnHint: 'Le gestionnaire opère le parc au quotidien et vous soumet les arbitrages.',
      delegateOffHint: 'Droits propriétaire et gestionnaire réunis sur votre compte.',
      matrixTitle: 'Matrice des droits',
      matrixCaption:
        'Actions autorisées pour chaque rôle, selon le mode de délégation choisi ci-dessus.',
      matrixDelegated: 'Colonne gestionnaire mise à jour — le gestionnaire a ses propres droits.',
      matrixSolo: 'Colonne gestionnaire mise à jour — aucun droit délégué.',
      capability: 'Action',
      allowed: 'Autorisé',
      denied: 'Non autorisé',
      managerOff: 'non activé',
      /**
       * SANS « CI-DESSUS ».
       *
       * La phrase désignait le sélecteur radio, que la délégation a emporté
       * avec elle en rejoignant les réglages du parc : elle renvoyait donc à un
       * contrôle absent de l'écran. Et elle ne peut pas nommer le nouveau
       * chemin non plus, parce qu'il n'est pas le même partout — un lien vers
       * les réglages sur un vrai parc, la bascule elle-même en démonstration.
       *
       * Elle énonce donc la RÈGLE, que les deux contextes partagent, et laisse
       * le contrôle voisin dire par lui-même où l'on va.
       */
      /* LE COMPTE VIENT DE LA TABLE — voir `GESTES_DELEGABLES`. La phrase
         disait la condition sans dire l'enjeu : on ne savait pas combien de
         gestes la bascule ferme. */
      managerOffNote:
        'Ces droits n’existent que si le parc est en gestion déléguée : {gestes} gestes que vous pourriez confier.',
      families: {
        build: 'Constituer le parc',
        operate: 'Exploiter au quotidien',
        arbitrate: 'Arbitrer ce qui engage l’argent',
        consult: 'Consulter',
      },
      caps: {
        viewAll: 'Consulter tout le parc',
        addBuilding: 'Déclarer un immeuble',
        addUnit: 'Déclarer un logement',
        issueReceipt: 'Émettre une quittance',
        recordPayment: 'Enregistrer un paiement',
        readMeters: 'Saisir les relevés',
        quoteWorks: 'Chiffrer des travaux',
        approveWorks: 'Valider un devis',
        settleDeposit: 'Arbitrer une caution',
        inviteTenant: 'Inviter un locataire',
        editPortfolio: 'Renommer ou supprimer',
        ownData: 'Consulter ses propres données',
      },
    },

    /**
     * LE MANUEL — et il ne recopie aucun nom de bouton.
     *
     * Les libellés des gestes et des écrans viennent des clés que le produit
     * peint déjà (`nav.*`, `app.lease.open`, …) : le manuel affiche ce que
     * l'utilisateur va réellement lire, et un bouton renommé renomme le manuel.
     * Ce bloc ne porte donc QUE les phrases d'explication — ce à quoi un geste
     * sert, et quand on le fait.
     *
     * Voir `features/dashboard/manuelDesGestes.ts`, dont l'en-tête dit pourquoi.
     */
    manual: {
      title: 'Manuel d’utilisation',
      subtitle:
        'Les gestes du mois, dans l’ordre où ils arrivent — et où chacun se trouve dans le produit.',

      /* ── LA VISITE FILMÉE ── */
      videoTitle: 'La visite du produit',
      videoBody:
        'Un parcours du produit en fonctionnement, sur le parc de démonstration. Rien n’y est mis en scène : ce sont les écrans que vous aurez.',
      videoTryIt: 'Ouvrir la démonstration',
      videoFallback:
        'Votre navigateur ne sait pas lire cette vidéo. La démonstration, elle, s’ouvre partout.',
      /* LE NOM DU LECTEUR, et non le titre de la section. Un lecteur média ne
         prend pas son nom de son contenu : le contenu d'un `<video>` est son
         repli, qu'un navigateur capable de lire la vidéo n'expose jamais.
         Mesuré le 2026-10-05 dans l'arbre d'accessibilité de Chrome : le
         lecteur y était `nom=""`, exposé et anonyme. */
      videoPlayerLabel: 'Visite filmée du produit',

      /* ── LES GESTES ── */
      mineTitle: 'Vos gestes',
      mineSubtitle: 'Ce que votre rôle fait dans le produit, du premier logement au relogement.',
      /* ── LE SOMMAIRE ── */
      /* « Sommaire » et non « Table des matières » : le même mot que les pages
         juridiques, qui portent le même composant. Deux noms pour une seule
         forme s'apprendraient deux fois. */
      contentsTitle: 'Sommaire',
      /* LE RAIL NE DIT PAS « Sommaire », ET C'EST VOULU : il ne liste pas, il
         SITUE. « Sur cette page » est la formule que les documentations
         emploient pour ça, et elle annonce l'espion plutôt qu'une table. */
      onThisPage: 'Sur cette page',
      /* L'INDICE DIT CE QU'ON FAIT DU LIEN, et ce n'est pas ce qu'on fait d'une
         clause. On ne cite pas un manuel : on envoie quelqu'un au bon endroit —
         un propriétaire à son gestionnaire, un gestionnaire à son locataire. */
      anchorHint: 'Chaque section a son adresse : ouvrez-la pour envoyer le lien à quelqu’un.',
      othersTitle: 'Ce que font les autres rôles',
      othersBody:
        'Utile pour savoir ce que vous déléguez, et ce que votre locataire voit de son côté. Les gestes y sont seulement nommés ; le détail est dans vos gestes à vous.',
      openScreen: 'Ouvrir {screen}',
      /* L'écran où vit le geste, nommé à côté de lui : sans cela, le lecteur a
         une liste de gestes et aucune idée d’où les chercher. */
      onScreen: 'Dans {screen}',

      gestes: {
        ajouterImmeuble:
          'Un immeuble porte une adresse et un quartier ; les logements se rattachent à lui. C’est le premier objet à créer, avant tout le reste.',
        ajouterLogement:
          'Numéro, type, surface et loyer de référence. Le loyer inscrit ici sert d’appui aux baux et aux annonces ; il ne les décide pas.',
        corrigerLeParc:
          'La devise du parc, les relances automatiques et le canal par lequel elles partent — SMS ou WhatsApp. Un réglage par parc, pas par locataire.',
        attribuerUnLocataire:
          'Rattache une personne à un logement et ouvre son bail. C’est ce geste qui fait apparaître ses échéances dans les paiements.',
        inviterParCode:
          'Un code à usage unique, remis à la personne. Elle crée son compte elle-même et rejoint le parc avec le rôle que vous avez choisi.',
        confierDesImmeubles:
          'Borne un gestionnaire à certains immeubles. Une liste vide ne veut pas dire « tout » : elle veut dire « rien », et c’est délibéré.',
        poserLesHonoraires:
          'Le barème du gestionnaire — une base de calcul et un taux — et le relevé de ce qu’il vous reverse sur la période. Sans barème, le relevé ne retient rien.',
        enregistrerUnPaiement:
          'Un versement reçu, avec sa date, son moyen et sa référence. Un règlement partiel est accepté : le solde suit sur la période suivante.',
        encaisser:
          'Solde une période en une fois, au montant exact qui reste dû. Le raccourci du cas courant.',
        joindreUnePreuve:
          'La photo du reçu ou de la notification de transfert, attachée au versement. C’est ce que vous ressortirez le jour où le montant est contesté.',
        relancerLesRetards:
          'Un message à tous les locataires en retard, d’un seul geste. Le canal est celui du parc, et le produit garde la trace de ce qui est parti.',
        mettreEnDemeure:
          'L’avertissement formel, nominatif, qui précède une procédure. À réserver à ce qu’une relance n’a pas réglé.',
        convenirUnPlan:
          'Un échéancier écrit pour solder un impayé. Son respect se DÉDUIT des versements réels — il n’y a rien à cocher — et il suspend les relances tant qu’il est tenu.',
        bailEtSuretes:
          'Le panneau qui réunit la vie du bail : le congé s’il est donné, l’historique des révisions, et les personnes qui se portent garantes.',
        reviserLeLoyer:
          'Un nouveau loyer à compter d’une date. Les échéances déjà appelées gardent l’ancien : une quittance remise ne se réécrit pas.',
        enregistrerUnConge:
          'La date à laquelle le départ est annoncé. Le bail reste actif jusqu’à la date de sortie, et le loyer continue d’être appelé.',
        chargesEtRegularisation:
          'Ce que vous refacturez et qui ne se calcule pas — ordures, gardiennage, ascenseur. La définition vit au bail, sa copie figée dans chaque échéance émise.',
        saisirUnReleve:
          'L’index du compteur d’eau et celui d’électricité. La consommation et son montant se déduisent de l’écart avec le relevé précédent.',
        saisirUneDepense:
          'Ce que le parc a payé : taxes, assurances, syndic, factures du distributeur, entretien. Les chantiers sont comptés à part, dans les travaux.',
        etablirUnEtatDesLieux:
          'L’état du logement à l’entrée ou à la sortie, réserve par réserve, photos comprises. C’est la pièce qui fait foi au moment de rendre la caution.',
        ouvrirUnChantier:
          'Une intervention avec son corps de métier, son urgence et son montant à valider. Son coût remonte dans les dépenses une fois le chantier achevé.',
        repondreAuLocataire:
          'La réponse écrite à ce qu’un locataire a signalé. Elle lui arrive dans son espace, et le fil reste attaché au signalement.',
        arbitrerUneCaution:
          'Ce qui est rendu et ce qui est retenu, avec le motif de chaque retenue. L’état des lieux de sortie est ce qui rend l’arbitrage défendable.',
        ouvrirUneAnnonce:
          'Le loyer demandé — distinct de la référence du logement —, la date de disponibilité et les candidats. Un logement dont le congé est donné peut déjà être annoncé : c’est la fenêtre qui évite la vacance.',
        registreDesDecisions:
          'Qui a fait quoi, et quand. Le registre n’est pas modifiable : c’est son intérêt, et c’est ce qui rend une délégation contrôlable.',
        exporterLeParc:
          'Un tableur de l’état du parc, à emporter hors du produit — pour un comptable, une banque, ou une sauvegarde qui ne dépend de personne.',
        voirCeQueJeDois:
          'Ce qui a été appelé, ce qui a été réglé, et ce qui reste. Avec vos relevés d’eau et d’électricité du mois.',
        telechargerMesQuittances:
          'Vos quittances en PDF, période par période. Elles vous servent partout où l’on demande une preuve de domicile ou de paiement.',
        signalerUnProbleme:
          'Une fuite, une panne, une nuisance. Ce que vous écrivez arrive au bailleur avec la date, et la réponse revient dans le même fil.',
      },
    },

    offline: {
      title: 'Serveur injoignable',
      body:
        'Votre session est peut-être toujours valable : ce n’est pas une déconnexion. Vérifiez votre connexion, puis réessayez.',
    },

    /* L'échec TERMINAL de la lecture de session. Deux corps pour deux causes :
       le serveur qui répond de travers, et le serveur qui ne répond pas à
       temps. Les confondre ferait chercher une panne inexistante. */
    /* Le repli de la frontière d'erreur. Distinct de `sessionFailure` : là,
       une requête a échoué ; ici, c'est le RENDU qui s'est interrompu, et
       l'écran n'existe plus du tout. Deux causes, deux phrases. */
    /* L'échec du CHARGEMENT DU PARC, rendu dans le cadre de l'écran et non
       plein écran : la coquille va bien, seules les données manquent. Deux
       causes, deux gestes — se reconnecter, ou réessayer. */
    parkFailure: {
      sessionTitle: 'Votre session a expiré',
      sessionBody:
        'Vos données n’ont pas pu être relues. Rien n’est perdu : terminez ce que vous faisiez, puis reconnectez-vous.',
      signIn: 'Se reconnecter',
      title: 'Données indisponibles',
      body:
        'Le serveur n’a pas rendu votre parc. Ce qui est affiché ailleurs reste valable ; réessayez dans un instant.',
    },

    sessionFailure: {
      title: 'Impossible d’ouvrir votre espace',
      body:
        'Le serveur a répondu, mais pas ce qu’il fallait. Votre session n’est pas perdue — réessayez dans un instant.',
      timeoutBody:
        'Le serveur n’a pas répondu à temps. La connexion est peut-être lente : réessayez, ou revenez plus tard.',
    },

    system: {
      /* LA LÉGENDE D'UN EXTRAIT — voir `SystemStates.tsx`, qui porte la raison. */
      sampleOf: '{shown} logements sur {total}',
      title: 'États du système',
      subtitle:
        'Les états que l’interface doit savoir afficher : chargement, vide, erreur, hors ligne.',
      loading: 'Chargement',
      empty: 'Vide',
      error: 'Erreur',
      offline: 'Hors ligne',
      errorTitle: 'Impossible de charger les encaissements',
      errorBody: 'La connexion a été interrompue. Vos données locales sont intactes.',
      retry: 'Réessayer',
      // « Rejouer » et non « Recharger » : rien n'est demandé au serveur, on
      // remontre un état. Le verbe dit qu'on est dans une vitrine.
      replayLoading: 'Rejouer le chargement',
      emptyTitle: 'Aucun paiement sur cette période',
      emptyBody: 'Dès qu’un règlement est enregistré, il apparaît ici avec sa quittance.',
      offlineTitle: 'Mode hors ligne',
      offlineBody:
        'Les relevés et états des lieux saisis maintenant seront synchronisés au retour du réseau.',
      persistence: 'Parcours enregistré',
      persistenceIdle:
        'Vos actions — devis validés, cautions arbitrées, fiches créées — sont enregistrées dans ce navigateur et survivent au rechargement. Rien n’a encore été modifié.',
      persistenceDirty:
        'Vos actions — devis validés, cautions arbitrées, fiches créées — sont enregistrées dans ce navigateur et survivent au rechargement.',
      persistenceScope:
        'Rien ne quitte votre machine : aucun serveur n’est contacté.',
      reset: 'Repartir du jeu de démonstration',
      resetDone: 'Démonstration réinitialisée',
      // « Implémentée » nommait un état de code à un lecteur non développeur —
      // le seul mot technique de cette vitrine, écrite pour être comprise sans
      // jargon. « Existe » dit la même chose en clair.
      offlineNotice:
        'La synchronisation différée n’existe pas encore dans le produit. Cette carte montre l’état tel qu’il s’affichera le jour où elle existera.',
    },

    // Vocabulaire partagé par les travaux et les signalements du portail :
    // les deux nommaient « Plomberie » et « Électricité » chacun de leur côté.
    report: {
      title: 'Signaler un problème',
      body: 'Votre gestionnaire et votre bailleur le reçoivent immédiatement. Décrivez ce que vous voyez : le devis et le corps de métier, ce n’est pas à vous de les fixer.',
      what: 'Que se passe-t-il ?',
      whatHint: 'Une phrase suffit. Vous pourrez détailler en dessous.',
      /* CE QUI EST DÉJÀ EN COURS — voir `ReportModal` : on redéclarait la même
         panne faute de nouvelle, et deux fiches partaient chez le
         gestionnaire. Accordé en nombre : le premier titre est nommé, les
         autres comptés. */
      /* DEUX PHRASES, ET NON UN ACCORD EN NOMBRE. Une première rédaction
         nommait le premier titre PUIS comptait — « « {titre} » et {count}
         autres » —, et les deux se chevauchaient : en français, `_one` couvre
         zéro ET un, donc « et 1 autre » n'aurait jamais pu se rendre. Un seul
         signalement se NOMME ; plusieurs se COMPTENT, et la liste est à un
         onglet de distance. */
      whatHintOpen: 'Déjà en cours sur ce logement : {count} signalements.',
      /* LE SINGULIER, QUE L'ÉCRAN N'APPELLE PAS — et la garde de parité a
         raison de l'exiger quand même : une clé qui interpole `{count}` doit
         porter sa variante, sans quoi le premier appelant qui lui passe un
         rend « 1 signalements ». Ici c'est `whatHintOpenOne` qui sert ce
         cas-là, en NOMMANT le signalement plutôt qu'en le comptant ; cette
         ligne est le filet, pas le chemin. */
      whatHintOpen_one: 'Déjà en cours sur ce logement : {count} signalement.',
      whatHintOpenOne: 'Déjà en cours sur ce logement : « {titre} ».',
      whatPlaceholder: 'Fuite sous l’évier de la cuisine',
      whatError: 'Décrivez le problème en quelques mots',
      trade: 'De quoi s’agit-il ?',
      urgency: 'À quel point est-ce urgent ?',
      urgency_blocking: 'Le logement n’est pas utilisable en l’état.',
      urgency_normal: 'Gênant, mais on peut vivre avec quelques jours.',
      urgency_low: 'À traiter quand ce sera commode.',
      detail: 'Détails',
      detailHint: 'Depuis quand, à quel moment, ce que vous avez déjà tenté.',
      send: 'Envoyer le signalement',
      sent: 'Signalement envoyé · votre gestionnaire est prévenu',
      mine: 'Mes signalements',
      /* LE FIL. Le texte de la réponse vient d'un humain et n'est pas traduit ;
         ces deux clés ne portent que l'habillage. */
      replyFrom: 'Réponse de votre gestionnaire',
      /* LE SENS MONTANT. « Vous » et non le nom : c'est SA phrase, relue dans
         son propre espace, et se voir nommer à la troisième personne dans sa
         propre conversation sonne comme un dossier, pas comme un échange. */
      replyMine: 'Votre réponse',
      replyLabel: 'Répondre',
      replyHint: 'Le gestionnaire et le bailleur la reçoivent.',
      replySend: 'Envoyer la réponse',
      replySent: 'Réponse envoyée',
      replyError: 'Au moins 3 caractères.',
      noReply: 'Pas encore de réponse',
      emptyTitle: 'Aucun signalement',
      emptyBody: 'Déclarez un problème et suivez son traitement ici : reçu, chiffré, validé, puis terminé.',
      cta: 'Signaler un problème',
    },
    trades: {
      plumbing: 'Plomberie',
      power: 'Électricité',
      painting: 'Peinture',
      multi: 'Multi-corps',
      lock: 'Serrurerie',
      other: 'Autre',
    },

    portal: {
      title: 'Portail locataire',
      subtitle: 'Ce que voit votre locataire depuis son navigateur.',
      space: 'Mon espace',
      // L'adresse de la fenêtre de démonstration, une par onglet. Elle était
      // écrite en dur, donc « /mon-espace » s'affichait au milieu d'une
      // interface anglaise — et restait « /mon-espace » quel que soit l'onglet
      // ouvert. Le garde-fou ne pouvait voir ni l'un ni l'autre : ces chaînes
      // ne portent aucun accent.
      urlSpace: 'portail.gestlocpro.com/mon-espace',
      urlDocuments: 'portail.gestlocpro.com/documents',
      urlReport: 'portail.gestlocpro.com/signaler',
      documents: 'Documents',
      report: 'Signaler',
    },
  },
} as const
