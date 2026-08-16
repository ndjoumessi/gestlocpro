/**
 * Dictionnaire français — source de vérité de la forme des clés.
 * `en.ts` est typé contre lui : toute clé ajoutée ici doit y être traduite,
 * sinon la compilation échoue.
 *
 * Interpolation : `{nom}` est remplacé par la variable passée à `t()`.
 */
export const fr = {
  brand: {
    name: 'GestLocPro',
    tagline: 'La gestion locative tenue comme un patrimoine',
  },

  common: {
    back: 'Retour',
    // Distincte de `back` : dans l'inscription, « Retour » ramène à l'étape
    // précédente. Deux destinations ne peuvent pas partager un libellé.
    backToHome: 'Retour à l’accueil',
    next: 'Continuer',
    cancel: 'Annuler',
    save: 'Enregistrer',
    edit: 'Modifier',
    close: 'Fermer',
    confirm: 'Confirmer',
    search: 'Rechercher',
    loading: 'Chargement…',
    required: 'obligatoire',
    optional: 'facultatif',
    currency: 'Devise',
    language: 'Langue',
    country: 'Pays',
    demoBadge: 'Démonstration',
    demoPark: 'Parc de démonstration',
    emptyParkTitle: 'Votre parc est encore vide',
    emptyParkBody:
      'Les indicateurs, les encaissements et les relances apparaîtront ici dès que votre parc portera des logements. Commencez par déclarer un immeuble.',
    emptyParkDemo: 'Voir ce que donne un parc rempli',
    newVersion: 'Une nouvelle version de GestLocPro est disponible.',
    newVersionReload: 'Recharger',
    actionRefused: 'Le serveur a refusé cette action. Rien n’a été enregistré.',
    actionFailed: 'Action impossible pour l’instant. Rien n’a été enregistré.',
    demoNotice:
      'Vous parcourez une démonstration : ces immeubles, ces locataires et ces montants sont fictifs.',
    demoCta: 'Créer mon espace',
    countryOther: 'Autre pays',
    countryOtherHint:
      'Votre pays n’est pas encore listé : choisissez vous-même la devise et la langue de votre espace.',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    phone: 'Téléphone',
    dialCode: 'Indicatif téléphonique',
    emailPlaceholder: 'nom@domaine.com',
    fullName: 'Nom complet',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    selectPlaceholder: 'Sélectionner…',
    period: 'Période',
    perMonth: '/ mois',
    perYear: '/ an',
    yes: 'Oui',
    no: 'Non',
  },

  status: {
    paid: 'À jour',
    partial: 'Partiel',
    overdue: 'En retard',
    vacant: 'Vacant',
    pending: 'En attente',
    done: 'Terminé',
  },

  roles: {
    owner: {
      name: 'Propriétaire',
      short: 'Vous détenez le patrimoine',
      rights: 'Lecture et édition globale · arbitrage des cautions',
      pitch:
        'Vue consolidée du parc, arbitrage des cautions, délégation des droits à un gestionnaire.',
    },
    manager: {
      name: 'Gestionnaire délégué',
      short: 'Vous opérez le parc au quotidien',
      rights: 'Gestion quotidienne · propose, ne décide pas',
      pitch:
        'Encaissements, relevés de compteurs, états des lieux, suivi des travaux. Vous proposez, le propriétaire arbitre.',
    },
    tenant: {
      name: 'Locataire',
      short: 'Vous occupez un logement',
      rights: 'Ses propres données uniquement',
      pitch:
        'Quittances, échéancier, signalement d’incident et suivi des travaux depuis votre espace.',
    },
  },

  nav: {
    dashboard: 'Tableau de bord',
    portfolio: 'Parc immobilier',
    payments: 'Paiements',
    meters: 'Relevés',
    inspections: 'États des lieux',
    works: 'Travaux',
    deposits: 'Cautions',
    tenants: 'Locataires',
    alerts: 'Signalements',
    onboarding: 'Prise en main et droits',
    system: 'États du système',
    tenantPortal: 'Portail locataire (web)',
    tenantApp: 'App locataire',
    sectionSteering: 'Pilotage',
    sectionOperations: 'Opérations',
    sectionAdmin: 'Administration',
    activeProfile: 'Profil actif',
    // Trois boutons portaient ce libellé pour trois actions différentes.
    // « Replier ou déplier » ne vaut que pour la barre latérale de bureau, qui
    // bascule entre pleine largeur et rail ; le tiroir mobile, lui, s'ouvre
    // depuis la barre supérieure et se ferme depuis son propre en-tête.
    toggleNav: 'Replier ou déplier la navigation',
    openNav: 'Ouvrir la navigation',
    closeNav: 'Fermer la navigation',
    searchPlaceholder: 'Rechercher un logement, un locataire…',
    primaryNav: 'Navigation principale',
    breadcrumb: 'Fil d’Ariane',
  },

  auth: {
    signIn: 'Se connecter',
    signUp: 'Créer un compte',
    signUpFree: 'Essayer gratuitement',
    logout: 'Se déconnecter',
    noAccount: 'Pas encore de compte ?',
    hasAccount: 'Vous avez déjà un compte ?',
    forgotPassword: 'Mot de passe oublié ?',

    login: {
      title: 'Content de vous revoir',
      subtitle: 'Reprenez la main sur votre parc.',
      submit: 'Se connecter',
      remember: 'Rester connecté sur cet appareil',
      success: 'Connexion réussie — bienvenue.',
      // Un seul message pour « compte inconnu » et « mot de passe faux » : les
      // distinguer ferait du formulaire un oracle d'existence de comptes, et
      // l'API refuse déjà de le dire.
      errorCredentials: 'Adresse e-mail ou mot de passe incorrect.',
      errorOffline: 'Le serveur est injoignable. Vérifiez votre connexion et réessayez.',
      errorUnexpected: 'La connexion a échoué. Réessayez dans un instant.',
    },

    forgot: {
      title: 'Réinitialiser votre mot de passe',
      subtitle:
        'Indiquez l’adresse de votre compte. Nous vous envoyons un lien de réinitialisation valable une heure.',
      submit: 'Envoyer le lien',
      backToLogin: 'Revenir à la connexion',
      sentTitle: 'Vérifiez votre boîte mail',
      sentBody:
        'Si un compte existe pour {email}, un lien de réinitialisation vient d’y être envoyé. Pensez à regarder dans les indésirables.',
      resend: 'Renvoyer le lien',
      demoLinkNotice:
        'L’envoi d’e-mail n’est pas encore branché. Voici le lien qu’il contiendra.',
    },

    reset: {
      title: 'Choisissez un nouveau mot de passe',
      subtitle: 'Il remplacera l’ancien sur tous vos appareils connectés.',
      newPassword: 'Nouveau mot de passe',
      confirm: 'Confirmez le mot de passe',
      confirmHint: 'Retapez-le à l’identique.',
      submit: 'Enregistrer le mot de passe',
      successTitle: 'Mot de passe modifié',
      successBody:
        'Vous pouvez vous connecter avec votre nouveau mot de passe. Les autres sessions ouvertes ont été déconnectées.',
      goToLogin: 'Se connecter',
      invalidTitle: 'Ce lien n’est plus valable',
      invalidBody:
        'Un lien de réinitialisation expire au bout d’une heure et ne sert qu’une fois. Demandez-en un nouveau.',
      askAnother: 'Demander un nouveau lien',
      demoNotice:
        'L’enregistrement n’est pas encore branché : le formulaire valide la saisie, puis affiche l’écran de confirmation.',
    },

    strength: {
      weak: 'Faible',
      fair: 'Moyen',
      good: 'Bon',
      strong: 'Robuste',
    },

    signup: {
      title: 'Créer votre compte',
      stepOf: 'Étape {current} sur {total}',
      steps: {
        role: 'Votre rôle',
        identity: 'Votre identité',
        context: 'Votre contexte',
        review: 'Récapitulatif',
      },

      roleTitle: 'Qui êtes-vous ?',
      roleSubtitle:
        'GestLocPro n’affiche pas la même chose selon votre rôle. Ce choix détermine vos droits, il reste modifiable ensuite.',

      identityTitle: 'Vos informations',
      identitySubtitle: 'Elles servent à sécuriser votre compte et à vous adresser vos quittances.',

      contextTitle: 'Votre contexte',
      contextSubtitle:
        'Le pays pré-remplit la devise et la langue de votre espace. Vous pouvez les changer.',

      reviewTitle: 'Tout est correct ?',
      reviewSubtitle: 'Dernière vérification avant la création de votre espace.',

      parkName: 'Nom de votre parc',
      parkNameHint: 'Le nom qui apparaîtra en tête de votre espace. Ex. « Parc Bonamoussadi ».',
      unitCount: 'Nombre d’unités gérées',
      unitCountHint: 'Une estimation suffit — elle oriente le palier tarifaire proposé.',
      management: 'Comment gérez-vous au quotidien ?',
      manageSolo: 'Je gère seul',
      manageSoloHint: 'Droits propriétaire et gestionnaire réunis sur un seul compte.',
      manageDelegate: 'Je délègue à un gestionnaire',
      manageDelegateHint: 'Vous invitez un gestionnaire ; il propose, vous arbitrez.',

      company: 'Cabinet ou société',
      companyHint: 'Laissez vide si vous exercez en votre nom propre.',
      ownerCode: 'Code d’invitation du propriétaire',
      ownerCodeHint:
        'Le propriétaire vous le communique depuis son espace. Sans code, votre demande lui sera soumise pour validation.',
      requestAccess: 'Je n’ai pas de code — envoyer une demande d’accès',

      inviteCode: 'Code d’invitation',
      inviteCodeHint:
        'Vous l’avez reçu par SMS ou par e-mail à la signature de votre bail. Format : LOC-XXXX-XXXX.',
      tenantNotice:
        'Un locataire ne crée pas son espace seul : il est rattaché à un bail existant. Sans code, demandez-le à votre gestionnaire.',

      terms: 'J’accepte les conditions générales et la politique de confidentialité.',
      termsError: 'Vous devez accepter les conditions pour créer votre compte.',
      // Posée sur le champ e-mail, à l'étape « Vos informations » : l'afficher
      // sur le récapitulatif la mettrait là où le champ n'existe pas.
      emailTaken: 'Un compte existe déjà avec cette adresse. Connectez-vous, ou utilisez-en une autre.',
      errorOffline: 'Le serveur est injoignable. Vos réponses sont conservées : réessayez.',
      errorUnexpected: 'La création du compte a échoué. Vos réponses sont conservées : réessayez.',
      newsletter: 'Recevoir les nouveautés produit (une fois par trimestre, sans revente de données).',

      submit: 'Créer mon espace',
      successTitle: 'Votre espace est prêt',
      successBody:
        'La création de compte n’est pas encore branchée. Voici l’espace {role} tel que vous le découvrirez.',
      goToDashboard: 'Ouvrir le tableau de bord',

      summaryRole: 'Rôle',
      summaryName: 'Nom',
      summaryEmail: 'E-mail',
      summaryPhone: 'Téléphone',
      summaryCountry: 'Pays',
      summaryCurrency: 'Devise',
      summaryLanguage: 'Langue',
      // Libellés de récapitulatif, distincts de ceux des champs. Un
      // formulaire pose une question — « Comment gérez-vous au quotidien ? » ;
      // un récapitulatif nomme une donnée. Réutiliser les premiers repliait
      // l'étiquette sur trois lignes et rompait avec les sept autres lignes.
      summaryPark: 'Parc',
      summaryUnits: 'Unités',
      summaryManagement: 'Gestion',
      summaryCompany: 'Cabinet',
      summaryOwnerCode: 'Code propriétaire',
      summaryInviteCode: 'Code d’invitation',
    },

    errors: {
      nameRequired: 'Indiquez votre nom complet.',
      emailRequired: 'Indiquez votre adresse e-mail.',
      emailInvalid: 'Cette adresse ne semble pas valide. Vérifiez le format : nom@domaine.com',
      passwordRequired: 'Choisissez un mot de passe.',
      passwordShort: 'Utilisez au moins 8 caractères.',
      phoneRequired: 'Indiquez un numéro de téléphone.',
      phoneInvalid: 'Ce numéro semble incomplet.',
      parkNameRequired: 'Donnez un nom à votre parc.',
      inviteRequired: 'Saisissez votre code d’invitation.',
      inviteInvalid: 'Code non reconnu. Format attendu : LOC-XXXX-XXXX.',
      credentials: 'E-mail ou mot de passe incorrect.',
      confirmRequired: 'Confirmez votre mot de passe.',
      confirmMismatch: 'Les deux saisies ne correspondent pas.',
      summaryTitle: 'Corrigez {count} points avant de continuer',
      summaryTitle_one: 'Corrigez {count} point avant de continuer',
    },
  },

  app: {
    period: 'Période',
    total: 'Total',
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
      collections: 'encaissements',
      meters: 'releves-compteurs',
      receipt: 'quittance',
    },
    paymentSaved: 'Paiement enregistré · quittance envoyée',
    roleNotice: 'Vous consultez l’espace en tant que {role}. Changez de profil dans la barre latérale.',
    demoBanner:
      'Les montants s’affichent en {currency} sans conversion de change.',

    tenant: {
      title: 'Mon espace locataire',
      subtitle: 'Votre logement, vos quittances et vos signalements.',
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
      alertsEmpty: 'Aucune notification vous concernant.',
      inspectionsEmpty: 'Aucun état des lieux enregistré pour votre logement.',
      manager: 'Votre gestionnaire',
      managerName: 'Diane F.',
      contactManager: 'Signaler un incident',
      privacyNote:
        'Vous ne voyez que les données de votre logement. Les autres locataires du parc ne vous sont pas visibles.',
      restrictedTitle: 'Accès restreint',
      restricted: 'Cet écran n’est pas accessible avec le profil locataire.',
      restrictedHint: 'Revenez à votre espace pour consulter vos propres données.',
      backToSpace: 'Retour à mon espace',
    },

    dashboard: {
      titleOwner: 'Vue consolidée du parc',
      titleManager: 'Ma journée de gestion',
      titleTenant: 'Mon espace locataire',
      subtitle: '{buildings} immeubles, {units} unités · montants en {currency}',
      expected: 'Loyers attendus',
      collected: 'Encaissé ce mois',
      outstanding: 'Impayés cumulés',
      occupancy: 'Taux d’occupation',
      // « vs mois précédent » accompagnait un écart mensuel qui a disparu :
      // il supposait un historique que le produit n'a pas, et l'indicateur
      // n'aurait jamais varié. La mention le suit, sans quoi elle renvoie à un
      // chiffre absent.
      activeLeases: '{count} baux actifs',
      activeLeases_one: '{count} bail actif',
      collectedShare: '{percent} % du dû',
      overdueTenants: '{count} locataires · jusqu’à {days} jours',
      overdueTenants_one: '{count} locataire · jusqu’à {days} jours',
      vacantUnits: '{count} unités vacantes',
      vacantUnits_one: '{count} unité vacante',
      chartTitle: 'Encaissements sur 12 mois',
      chartTableCaption:
        'Chiffres mensuels derrière le graphique, ventilés en loyer, eau et électricité.',
      chartNote:
        'Montants encaissés par mois, ventilés entre loyer, eau et électricité. Le mois en cours est encore ouvert.',
      // Portée dans l'infobulle de la dernière colonne : sans elle, le creux
      // du mois courant se lit comme une chute d'encaissement.
      openMonth: 'Mois en cours, encore ouvert.',
      recoveryTitle: 'Recouvrement du mois',
      recoveryTableCaption: 'Montants derrière le graphique, ventilés par statut de règlement.',
      recoveryCollected: 'Payé',
      recoveryPartial: 'Partiel',
      recoveryLate: 'En retard',
      rebilled: 'Charges refacturées',
      decisionsTitle: 'Ce qui demande une décision',
      decisionsEmpty: 'Rien à arbitrer pour le moment.',
      scheduleTitle: 'Échéancier',
      breakdownTitle: 'Répartition du parc',
      legendRent: 'Loyer',
      legendWater: 'Eau',
      legendPower: 'Électricité',
    },

    portfolio: {
      unitType: 'Typologie',
      addUnitTitle: 'Ajouter un logement',
      addUnitDescription:
        'Le logement est créé vacant : vous y rattacherez un locataire ensuite, depuis l’écran Locataires.',
      unitBuilding: 'Immeuble',
      unitLabel: 'Numéro du logement',
      unitLabelPlaceholder: 'A1',
      unitLabelRequired: 'Requis',
      unitLabelTaken: 'Ce numéro existe déjà dans cet immeuble',
      unitSurface: 'Surface (m²)',
      unitRent: 'Loyer mensuel',
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
      subtitle: 'Trois immeubles, douze unités. Le statut porte sur le mois affiché.',
      unit: 'Unité',
      building: 'Immeuble',
      type: 'Type',
      surface: 'Surface',
      rent: 'Loyer',
      tenant: 'Locataire',
      status: 'Statut',
      noTenant: 'Aucun locataire',
      occupancy: '{occupied}/{total} occupées',
      filterAll: 'Toutes',
      resetFilters: 'Réinitialiser les filtres',
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
      quittance: 'Quittance de loyer',
      recu: 'Reçu de paiement',
      tenant: 'Locataire',
      unit: 'Logement',
      due: 'Montant dû',
      paid: 'Montant reçu',
      balance: 'Solde',
      credit: '{amount} d’avance',
      payments: 'Versements',
      print: 'Imprimer',
      noCharge: 'Aucune échéance pour cette période : il n’y a rien à attester.',
      issue: 'Quittance',
    },
    payments: {
      title: 'Suivi des paiements par période',
      subtitle: 'Un règlement partiel reste possible : le solde suit sur la période suivante.',
      filterAll: 'Tous',
      due: 'Dû',
      paid: 'Réglé',
      balance: 'Solde',
      method: 'Moyen',
      date: 'Date',
      period: 'Période couverte',
      periodHint: 'Le mois que ce versement règle — pas forcément le mois où il est reçu.',
      paidOn: 'Date du versement',
      paidOnHint: 'Quand l’argent a été reçu. Distincte du mois qu’il règle.',
      reference: 'Référence de la transaction',
      referenceHint: 'Numéro Mobile Money, référence du virement, numéro de chèque. C’est par lui que le versement se retrouve sur le relevé bancaire.',
      amount: 'Montant',
      amountHint: 'Un règlement partiel est accepté.',
      methodMobile: 'Mobile money',
      methodCash: 'Espèces',
      methodTransfer: 'Virement',
      methodCheck: 'Chèque',
      modalTitle: 'Enregistrer un paiement',
      modalDescription: 'Le locataire recevra sa quittance par e-mail et par SMS.',
      selectUnit: 'Unité',
      amountInvalid: 'Saisissez un montant supérieur à zéro.',
      dueAmount: 'Dû : {amount}',
      overdueDays: '+{days} j',
      // En-tête de colonne de l'export : « +24 j » est une abréviation
      // d'affichage, illisible en tête d'une colonne de tableur.
      lateDays: 'Jours de retard',
    },

    meters: {
      title: 'Relevé des compteurs',
      subtitle:
        'Index relevés sur place. La consommation est refacturée au prorata sur la quittance du mois.',
      water: 'Eau',
      power: 'Électricité',
      previous: 'Index précédent',
      current: 'Index du mois',
      consumption: 'Consommation',
      rebilled: 'Refacturé',
      readAt: 'Relevé le',
      missing: 'Relevé manquant',
      missingCount: '{count} relevés manquants pour la période',
      missingCount_one: '{count} relevé manquant pour la période',
      missingHint: 'La facturation du mois restera incomplète tant qu’ils ne sont pas saisis.',
      complete: 'Tous les relevés sont saisis pour la période.',
      totalRebilled: 'Total refacturé',
      capturedCount: '{done} sur {total} saisis',
    },

    inspections: {
      title: 'États des lieux',
      subtitle: 'Entrée et sortie comparées pièce par pièce, réserves chiffrées et imputées sur la caution.',
      entry: 'Entrée',
      exit: 'Sortie',
      rooms: '{count} pièces',
      rooms_one: '{count} pièce',
      issues: '{count} réserves',
      issues_one: '{count} réserve',
      noIssues: 'Aucune réserve',
      signed: 'Signé',
      unsigned: 'En attente de signature',
      compare: 'Comparer entrée et sortie',
    },

    works: {
      title: 'Travaux et signalements',
      subtitle: 'Le locataire signale, le gestionnaire chiffre, le propriétaire arbitre.',
      reported: 'Signalé',
      quoted: 'Devis proposé',
      approved: 'Validé',
      done: 'Terminé',
      urgent: 'Urgent',
      noQuote: 'Pas encore chiffré',
      approve: 'Valider le devis',
      approved_toast: 'Devis validé · le gestionnaire est prévenu',
      trade: 'Corps d’état',
      managerNotice:
        'Seul le propriétaire valide les devis. Vous les préparez, il tranche.',
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
      },
    },

    deposits: {
      title: 'Cautions',
      subtitle: 'Montant consigné, retenues justifiées, solde restitué.',
      // Affiché quand la caution n'est plus rattachée à personne.
      formerTenant: 'Ancien locataire',
      held: 'Consignée',
      settling: 'En cours d’arbitrage',
      returned: 'Restituée',
      amountHeld: 'Consigné',
      withheld: 'Retenu',
      balance: 'À restituer',
      totalHeld: 'Total consigné',
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
      settled: 'Caution arbitrée · décompte envoyé au locataire',
      errorTooHigh: 'La retenue ne peut pas dépasser la caution consignée, soit {amount}.',
      errorJustification: 'Justifiez la retenue : le locataire peut la contester.',
      managerNotice:
        'Seul le propriétaire arbitre les cautions. Vous préparez le décompte, il le valide.',
    },

    tenants: {
      title: 'Locataires et baux',
      subtitle: 'Chaque locataire est rattaché à une unité par un bail actif.',
      addTenant: 'Créer une fiche locataire',
      leaseStart: 'Début du bail',
      leaseStartHint: 'Laissez vide pour aujourd’hui. Renseignez la vraie date pour un locataire déjà en place.',
      leaseRent: 'Loyer du bail',
      leaseRentHint: 'Laissez vide pour reprendre le loyer de référence du logement.',
      modalTitle: 'Nouvelle fiche locataire',
      modalDescription: 'Un code d’invitation lui sera envoyé par SMS pour activer son espace.',
      created: 'Fiche locataire créée · code d’invitation envoyé par SMS',
      phoneHint: 'Le code d’invitation y sera envoyé.',
      since: 'Locataire depuis',
      contact: 'Contact',
      vacantList: '{count} unités vacantes : {units}',
      vacantList_one: '{count} unité vacante : {units}',
      noVacantNotice:
        'Tout le parc est loué. Une fiche locataire a besoin d’une unité vacante à laquelle se rattacher.',
    },

    alerts: {
      title: 'Signalements et notifications',
      subtitle: 'Ce que le produit a détecté ou reçu, du plus récent au plus ancien.',
      markRead: 'Tout marquer comme lu',
      allRead: 'Toutes les notifications sont lues.',
      empty: 'Rien à signaler sur le parc.',
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
      },
      msg: {
        rentOverdue: {
          title: 'Loyer {unit} en retard de {count} jours',
          title_one: 'Loyer {unit} en retard de {count} jour',
          detail: '{tenant} · relance partie le {date}',
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
        partialPayment: {
          title: 'Règlement partiel enregistré sur {unit}',
          detail: '{tenant} · {amount} sur {total}',
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

    onboarding: {
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
      caps: {
        viewAll: 'Consulter tout le parc',
        recordPayment: 'Enregistrer un paiement',
        readMeters: 'Saisir les relevés',
        quoteWorks: 'Chiffrer des travaux',
        approveWorks: 'Valider un devis',
        settleDeposit: 'Arbitrer une caution',
        inviteTenant: 'Inviter un locataire',
        editPortfolio: 'Modifier le parc',
        ownData: 'Consulter ses propres données',
      },
    },

    offline: {
      title: 'Serveur injoignable',
      body:
        'Votre session est peut-être toujours valable : ce n’est pas une déconnexion. Vérifiez votre connexion, puis rechargez la page.',
    },

    system: {
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
      retried: 'Nouvelle tentative · données rechargées',
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
      offlineNotice:
        'La synchronisation différée n’est pas encore implémentée. Cette carte montre l’état tel qu’il s’affichera le jour où elle le sera.',
    },

    // Vocabulaire partagé par les travaux et les signalements du portail :
    // les deux nommaient « Plomberie » et « Électricité » chacun de leur côté.
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
      // L'adresse de la fenêtre de démonstration. Elle était écrite en dur,
      // donc « /mon-espace » s'affichait au milieu d'une interface anglaise.
      // Le garde-fou ne pouvait pas la voir : elle ne porte aucun accent.
      demoUrl: 'portail.gestlocpro.com/mon-espace',
      docLease: 'Bail signé',
      docInspection: 'État des lieux d’entrée',
      docReceipt: 'Quittance du mois',
      docInsurance: 'Attestation d’assurance',
      /**
       * Trois de ces quatre documents n'existent nulle part dans le produit :
       * aucun dépôt de fichier ne les crée. Leur bouton « Télécharger » ne
       * pouvait donc rien produire d'autre qu'un faux — mieux vaut dire que
       * la case est vide que fabriquer un fichier vide.
       */
      docUnavailable: 'Aucun document déposé',
      myPayments: 'Mes paiements',
      myWorks: 'Travaux',
      documents: 'Documents',
      report: 'Signaler',
      nextDue: 'Prochaine échéance',
      myUnit: 'Mon logement',
      downloadReceipt: 'Télécharger la quittance',
      reportIssue: 'Signaler un incident',
      reportSent: 'Signalement envoyé au gestionnaire et au propriétaire',
      category: 'Nature du problème',
      urgency: 'Urgence',
      urgencyHigh: 'Bloquant',
      urgencyMedium: 'Gênant',
      urgencyLow: 'Peut attendre',
      describe: 'Décrivez le problème',
      describeHint: 'Le gestionnaire reçoit votre message et vous répond depuis cet espace.',
      describeRequired:
        'Décrivez le problème : le gestionnaire intervient sur ce que vous écrivez ici.',
    },
  },

  notFound: {
    code: 'Erreur 404',
    title: 'Cette page n’existe pas',
    body: 'L’adresse demandée ne correspond à aucune page de GestLocPro. Elle a peut-être été mal recopiée, ou le lien qui vous a mené ici est périmé.',
    // L'adresse fautive est affichée : sans elle, l'utilisateur ne peut ni
    // corriger sa saisie ni signaler utilement le lien mort.
    attempted: 'Adresse demandée',
    home: 'Retour à l’accueil',
    demo: 'Ouvrir la démonstration',
    signIn: 'Se connecter',
    appTitle: 'Écran introuvable',
    appBody:
      'Cette adresse ne correspond à aucun écran de l’espace de gestion. Les écrans disponibles sont listés dans la barre latérale.',
    appAction: 'Revenir au tableau de bord',
  },

  marketing: {
    nav: {
      features: 'Fonctionnalités',
      roles: 'Pour qui',
      pricing: 'Tarifs',
      faq: 'Questions',
      openMenu: 'Ouvrir le menu',
      closeMenu: 'Fermer le menu',
    },

    hero: {
      eyebrow: 'Gestion locative multi-pays',
      title: 'Votre parc locatif, tenu comme un patrimoine.',
      subtitle:
        'Loyers, eau, électricité, relances, états des lieux et cautions dans un seul registre. Vos locataires suivent leur situation ; vous gardez la décision.',
      ctaPrimary: 'Créer mon espace',
      ctaSecondary: 'Voir le tableau de bord',
      trust: 'Sans carte bancaire · 30 jours d’essai · Résiliable à tout moment',
    },

    metrics: {
      title: 'Ce que le registre tient à jour',
      collected: 'Encaissé ce mois',
      occupancy: 'Taux d’occupation',
      overdue: 'Impayés cumulés',
      reminders: 'Relances envoyées',
      note: 'Chiffres de démonstration, parc d’exemple de 12 unités.',
    },

    value: {
      eyebrow: 'Le problème',
      title: 'Un carnet, deux tableurs et un fil de discussion.',
      body:
        'C’est ainsi que se gère l’essentiel du parc locatif privé. Les relevés d’eau se perdent, les relances arrivent trop tard, et personne ne retrouve l’état des lieux d’entrée trois ans après.',
      before: {
        one: 'Les relevés de compteurs se notent sur papier puis se recopient.',
        two: 'Les retards se découvrent en fin de trimestre.',
        three: 'L’état des lieux de sortie se discute de mémoire.',
        four: 'Le gestionnaire et le propriétaire travaillent sur deux versions.',
      },
    },

    features: {
      eyebrow: 'Fonctionnalités',
      title: 'Ce que fait le produit',
      subtitle: 'Six chantiers de la gestion locative, traités de bout en bout.',
      rent: {
        title: 'Suivi des loyers',
        body: 'Échéancier par bail, encaissements partiels, quittance générée à chaque règlement.',
      },
      utilities: {
        title: 'Eau et électricité',
        body: 'Relevé d’index par unité, calcul de la consommation, refacturation au prorata sur la quittance.',
      },
      reminders: {
        title: 'Relances automatiques',
        body: 'SMS et e-mail déclenchés à J+1, J+7, J+15. Vous fixez le ton, le produit tient le calendrier. Automatiques à partir du palier Pro.',
      },
      inspections: {
        title: 'États des lieux',
        body: 'Entrée et sortie comparées pièce par pièce, réserves relevées et horodatées, imputation chiffrée sur la caution.',
      },
      works: {
        title: 'Travaux et signalements',
        body: 'Le locataire signale, le gestionnaire chiffre, le propriétaire arbitre. Chaque étape est tracée.',
      },
      deposits: {
        title: 'Cautions',
        body: 'Montant consigné, retenues justifiées, solde restitué. L’historique reste consultable des deux côtés.',
      },
    },

    roles: {
      eyebrow: 'Trois rôles',
      title: 'Chacun voit ce qui le concerne',
      subtitle:
        'Un même registre, trois lectures. Le gestionnaire propose, le propriétaire décide, le locataire consulte.',
      seeMore: 'Ce que ce rôle peut faire',
    },

    international: {
      eyebrow: 'International',
      title: 'Pensé pour plusieurs marchés',
      body:
        '{currencies} devises, {locales} langues d’interface, indicatifs téléphoniques et formats de date locaux. Le franc CFA couvre les deux zones, de Douala à Dakar, avec les indicatifs et les usages de chaque pays.',
      currencies: 'Devises prises en charge',
      languages: 'Langues de l’interface',
      countries: 'Pays proposés à l’inscription',
    },


    pricing: {
      eyebrow: 'Tarifs',
      title: 'Un prix par unité gérée',
      subtitle:
        'Pas de commission sur les loyers, jamais. Vous payez l’abonnement et les unités que vous gérez.',
      monthly: 'Mensuel',
      yearly: 'Annuel',
      yearlySave: '−20 %',
      popular: 'Le plus choisi',
      quote: 'Sur devis',
      trial: '30 jours d’essai, sans carte bancaire',
      cta: 'Commencer',
      ctaEnterprise: 'Nous contacter',
      unitsSelector: 'Combien d’unités gérez-vous ?',
      unitsValue: '{count} unités',
      unitsValue_one: '{count} unité',
      unitsValueMax: '{count} unités et plus',
      unitsValueMax_one: '{count} unité et plus',
      unitsHint: 'Faites glisser pour voir le prix de votre parc.',
      perUnitNote: '{base} + {perUnit} par unité',
      // Le montant exact est donné plutôt que le seul mot « arrondi » : le
      // prospect qui a posé le calcul retrouve son résultat, au lieu de rester
      // avec un écart qu'on lui demande d'admettre.
      roundingNote: 'Arrondi : la formule donne {exact}.',
      currencyNote:
        'Prix ancrés localement par devise, sans conversion de change automatique.',
      essential: { name: 'Essentiel', pitch: 'Un premier immeuble à tenir proprement.' },
      pro: { name: 'Pro', pitch: 'Un parc constitué, avec de la délégation.' },
      cabinet: { name: 'Cabinet', pitch: 'Plusieurs propriétaires, plusieurs sociétés.' },
      // Résume les quatre lignes retirées de la matrice, cochées à
      // l'identique sur les trois paliers.
      allIncluded:
        'Inclus partout : suivi des loyers et quittances, relevés d’eau et d’électricité, états des lieux comparés, portail locataire.',
      features: {
        units: 'Unités',
        rent: 'Suivi des loyers et quittances',
        meters: 'Relevés eau et électricité',
        portal: 'Portail locataire',
        reminders: 'Relances',
        remindersManual: 'Manuelles',
        remindersAuto: 'Automatiques',
        managers: 'Gestionnaires délégués',
        inspections: 'États des lieux comparés',
        exports: 'Export comptable',
        multiCompany: 'Multi-sociétés',
        support: 'Accompagnement',
        supportEmail: 'Par e-mail',
        supportPriority: 'Prioritaire',
        supportDedicated: 'Dédié',
      },
    },

    faq: {
      eyebrow: 'Questions',
      title: 'Ce qu’on nous demande',
      one: {
        q: 'GestLocPro convertit-il les devises ?',
        a: 'Non, et c’est volontaire. Chaque parc tient sa comptabilité dans sa devise. Le sélecteur change le format d’affichage, pas la valeur : aucun taux de change n’est appliqué à vos montants.',
      },
      two: {
        q: 'Mes locataires doivent-ils créer un compte ?',
        a: 'Ils reçoivent un code d’invitation à la signature du bail. Ce code les rattache à leur logement — personne ne peut s’auto-déclarer locataire d’une de vos unités.',
      },
      three: {
        q: 'Puis-je donner accès à mon gestionnaire sans tout lui confier ?',
        a: 'Oui. Le gestionnaire opère au quotidien — encaissements, relevés, travaux — mais l’arbitrage des cautions et l’édition globale restent au propriétaire.',
      },
      four: {
        q: 'Que se passe-t-il si j’arrête ?',
        a: 'Vous exportez l’intégralité de vos données en CSV et PDF, quittances et états des lieux compris. Aucune période de rétention forcée.',
      },
      five: {
        q: 'Faut-il installer quelque chose ?',
        a: 'Non. GestLocPro s’utilise depuis un navigateur, sur ordinateur comme sur téléphone. Vos locataires accèdent à leur espace par un lien reçu à la signature du bail, sans rien installer.',
      },
    },

    finalCta: {
      title: 'Reprenez votre parc en main',
      subtitle: 'Créez votre espace en deux minutes. Aucune carte bancaire demandée.',
      cta: 'Créer mon espace',
      secondary: 'Parcourir la démonstration',
    },

    footer: {
      product: 'Produit',
      company: 'Société',
      legal: 'Légal',
      about: 'À propos',
      contact: 'Contact',
      terms: 'Conditions générales',
      privacy: 'Confidentialité',
      cookies: 'Cookies',
      demo: 'Démonstration',
      rights: '© {year} GestLocPro.',
    },
  },
} as const

/** Forme du dictionnaire, avec des chaînes libres en feuilles. */
export type DictionaryShape<T> = {
  [K in keyof T]: T[K] extends string ? string : DictionaryShape<T[K]>
}

export type Dictionary = DictionaryShape<typeof fr>
