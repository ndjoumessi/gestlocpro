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
    onboarding: 'Onboarding & droits',
    system: 'États du système',
    tenantPortal: 'Portail locataire (web)',
    tenantApp: 'App locataire',
    sectionSteering: 'Pilotage',
    sectionOperations: 'Opérations',
    sectionAdmin: 'Administration',
    activeProfile: 'Profil actif',
    toggleNav: 'Replier ou déplier la navigation',
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
      demoNotice:
        'Maquette : aucune authentification réelle. Le formulaire valide la saisie puis vous ouvre le tableau de bord.',
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
      newsletter: 'Recevoir les nouveautés produit (une fois par trimestre, sans revente de données).',

      submit: 'Créer mon espace',
      successTitle: 'Votre espace est prêt',
      successBody:
        'Maquette : aucun compte n’a réellement été créé. Voici l’espace {role} tel que vous le découvririez.',
      goToDashboard: 'Ouvrir le tableau de bord',

      summaryRole: 'Rôle',
      summaryName: 'Nom',
      summaryEmail: 'E-mail',
      summaryPhone: 'Téléphone',
      summaryCountry: 'Pays',
      summaryCurrency: 'Devise',
      summaryLanguage: 'Langue',
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
      summaryTitle: 'Corrigez {count} point(s) avant de continuer',
    },
  },

  app: {
    period: 'Période',
    exportStatement: 'Exporter le relevé',
    recordPayment: 'Enregistrer un paiement',
    exported: 'Relevé du mois exporté (PDF + CSV)',
    paymentSaved: 'Paiement enregistré · quittance envoyée',
    roleNotice: 'Vous consultez l’espace en tant que {role}. Changez de profil dans la barre latérale.',
    demoBanner:
      'Maquette de démonstration : données fictives, aucun serveur contacté. Les montants s’affichent en {currency} sans conversion de change.',

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
      activeLeases: '{count} baux actifs · vs mois précédent',
      collectedShare: '{percent} % du dû',
      overdueTenants: '{count} locataires · jusqu’à {days} jours',
      vacantUnits: '{count} unités vacantes',
      chartTitle: 'Encaissements sur 12 mois',
      chartNote:
        'Montants encaissés par mois, ventilés entre loyer, eau et électricité. Le mois en cours est encore ouvert.',
      recoveryTitle: 'Recouvrement du mois',
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
      searchEmpty: 'Aucune unité ne correspond à « {query} ».',
      searchEmptyHint: 'Essayez un numéro d’unité, un nom de locataire ou un quartier.',
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
      missingHint: 'La facturation du mois restera incomplète tant qu’ils ne sont pas saisis.',
      complete: 'Tous les relevés sont saisis pour la période.',
      totalRebilled: 'Total refacturé',
    },

    inspections: {
      title: 'États des lieux',
      subtitle: 'Entrée et sortie comparées pièce par pièce, réserves chiffrées et imputées sur la caution.',
      entry: 'Entrée',
      exit: 'Sortie',
      rooms: '{count} pièces',
      issues: '{count} réserves',
      noIssues: 'Aucune réserve',
      signed: 'Signé',
      unsigned: 'En attente de signature',
      compare: 'Comparer entrée et sortie',
    },

    works: {
      title: 'Travaux & signalements',
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
    },

    deposits: {
      title: 'Cautions',
      subtitle: 'Montant consigné, retenues justifiées, solde restitué.',
      held: 'Consignée',
      settling: 'En cours d’arbitrage',
      returned: 'Restituée',
      amountHeld: 'Consigné',
      withheld: 'Retenu',
      balance: 'À restituer',
      totalHeld: 'Total consigné',
    },

    tenants: {
      title: 'Locataires & baux',
      subtitle: 'Chaque locataire est rattaché à une unité par un bail actif.',
      addTenant: 'Créer une fiche locataire',
      modalTitle: 'Nouvelle fiche locataire',
      modalDescription: 'Un code d’invitation lui sera envoyé par SMS pour activer son espace.',
      created: 'Fiche locataire créée · code d’invitation envoyé par SMS',
      since: 'Locataire depuis',
      contact: 'Contact',
    },

    alerts: {
      title: 'Signalements & notifications',
      subtitle: 'Ce que le produit a détecté ou reçu, du plus récent au plus ancien.',
      markRead: 'Tout marquer comme lu',
      allRead: 'Toutes les notifications sont lues.',
      unread: '{count} non lues',
      severityHigh: 'Prioritaire',
      severityMedium: 'À suivre',
      severityLow: 'Pour information',
    },

    onboarding: {
      title: 'Onboarding & délégation des droits',
      subtitle: 'Qui peut faire quoi, et comment inviter un gestionnaire ou un locataire.',
      delegateOn: 'Gestion déléguée',
      delegateOff: 'Vous gérez seul',
      delegateOnHint: 'Le gestionnaire opère le parc au quotidien et vous soumet les arbitrages.',
      delegateOffHint: 'Droits propriétaire et gestionnaire réunis sur votre compte.',
      matrixTitle: 'Matrice des droits',
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
      offlineNotice:
        'Maquette : la synchronisation différée n’est pas implémentée. Cette carte montre l’état tel qu’il devra s’afficher le jour où elle le sera.',
    },

    portal: {
      title: 'Portail locataire',
      subtitle: 'Ce que voit votre locataire depuis son navigateur.',
      space: 'Mon espace',
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
    },
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
      settingsLabel: 'Vos préférences d’affichage',
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
      afterTitle: 'Avec GestLocPro',
      before: {
        one: 'Les relevés de compteurs se notent sur papier puis se recopient.',
        two: 'Les retards se découvrent en fin de trimestre.',
        three: 'L’état des lieux de sortie se discute de mémoire.',
        four: 'Le gestionnaire et le propriétaire travaillent sur deux versions.',
      },
      after: {
        one: 'Relevés saisis sur place, charges refacturées automatiquement.',
        two: 'Retard signalé à l’échéance, relance partie le lendemain.',
        three: 'Entrée et sortie comparées pièce par pièce, réserve par réserve.',
        four: 'Un seul registre, des droits distincts, chaque geste horodaté.',
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
        '{currencies} devises, {locales} langues d’interface, indicatifs téléphoniques et formats de date locaux. Le franc CFA est traité correctement : XAF et XOF sont deux codes distincts, pas un alias.',
      currencies: 'Devises prises en charge',
      languages: 'Langues de l’interface',
      countries: '{count} pays proposés à l’inscription',
    },

    proof: {
      eyebrow: 'Témoignages',
      title: 'Ce qu’en disent nos utilisateurs',
      disclaimer:
        'Témoignages illustratifs — GestLocPro est en construction et ces personnes sont fictives.',
      one: {
        quote:
          'Les relevés d’eau étaient mon cauchemar de fin de mois. Ils se saisissent maintenant sur place, et la refacturation tombe toute seule sur la quittance.',
        name: 'Personne fictive',
        role: 'Propriétaire · 14 unités',
      },
      two: {
        quote:
          'Je propose, le propriétaire arbitre. Ce partage des droits a mis fin aux malentendus sur qui avait validé quoi.',
        name: 'Personne fictive',
        role: 'Gestionnaire délégué · 3 immeubles',
      },
      three: {
        quote:
          'Je vois mon échéancier et mes quittances sans avoir à réclamer. Mon signalement de plomberie a été pris en charge en deux jours.',
        name: 'Personne fictive',
        role: 'Locataire',
      },
    },

    pricing: {
      eyebrow: 'Tarifs',
      title: 'Un prix par unité gérée',
      subtitle:
        'Pas de commission sur les loyers. Le portail locataire est inclus dans tous les paliers.',
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
      unitsValueMax: '{count} unités et plus',
      unitsHint: 'Faites glisser pour voir le prix de votre parc.',
      perUnitNote: '{base} + {perUnit} par unité',
      currencyNote:
        'Prix ancrés localement par devise, sans conversion de change automatique.',
      essential: { name: 'Essentiel', pitch: 'Un premier immeuble à tenir proprement.' },
      pro: { name: 'Pro', pitch: 'Un parc constitué, avec de la délégation.' },
      cabinet: { name: 'Cabinet', pitch: 'Plusieurs propriétaires, plusieurs sociétés.' },
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
      rights: '© {year} GestLocPro. Maquette de démonstration.',
      builtNote:
        'Cette interface est une maquette : les données sont fictives et aucun serveur n’est contacté.',
    },
  },
} as const

/** Forme du dictionnaire, avec des chaînes libres en feuilles. */
export type DictionaryShape<T> = {
  [K in keyof T]: T[K] extends string ? string : DictionaryShape<T[K]>
}

export type Dictionary = DictionaryShape<typeof fr>
