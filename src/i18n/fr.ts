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
    skipToContent: 'Aller au contenu',
    next: 'Continuer',
    cancel: 'Annuler',
    save: 'Enregistrer',
    edit: 'Modifier',
    close: 'Fermer',
    // Distincte de `close` : plusieurs boutons « Fermer » peuvent coexister à
    // l'écran — celui d'une fenêtre modale et celui d'un toast posé par-dessus.
    // Un libellé partagé les rendrait indiscernables à la voix.
    closeNotification: 'Fermer la notification',
    undo: 'Annuler l’action',
    confirm: 'Confirmer',
    // Distincte de `app.system.retry`, qui vit dans la vitrine des états : là,
    // le bouton ne relit rien, il rejoue un état pour le montrer. Ici il relance
    // une vraie lecture après un vrai échec. Deux gestes, deux clés.
    retry: 'Réessayer',
    search: 'Rechercher',
    /* Le nom accessible du déclencheur à trois points : ils ne se prononcent
       pas, et « menu » seul ne dirait pas de quoi. */
    moreActions: 'Autres actions',
    loading: 'Chargement…',
    required: 'obligatoire',
    optional: 'facultatif',
    currency: 'Devise',
    /**
     * LE NOM DES DEVISES, ET C'EST LA SEULE LISTE QUI LES NOMME.
     *
     * Elles vivaient en dur dans `currency/currencies.ts`, hors du
     * dictionnaire : `t()` ne les voyait pas, `check-i18n` non plus — il
     * contrôle le JSX, pas un module de données. Deux d'entre elles se
     * désignaient d'ailleurs par leur propre code — « CAD ($) » — dans un menu
     * qui affiche ce code juste à côté.
     *
     * Le symbole reste entre parenthèses : les deux dollars le partagent, il ne
     * distingue rien seul, mais il ancre le nom sur ce qu'on lit ensuite à côté
     * des montants.
     *
     * `CFA` couvre les DEUX zones franc — l'écran n'en affiche qu'une devise,
     * même parité, même sigle. Le parc, lui, doit trancher pour le stockage :
     * ses deux entrées qualifiées vivent dans `app.parkSettings`, et elles sont
     * les seules à ne pas venir d'ici.
     */
    currencyNames: {
      CFA: 'Franc CFA (FCFA)',
      EUR: 'Euro (€)',
      CAD: 'Dollar canadien ($)',
      USD: 'Dollar américain ($)',
    },
    language: 'Langue',
    theme: 'Thème',
    country: 'Pays',
    dialZoneCfa: 'Zone franc CFA',
    dialZoneOther: 'Autres pays',
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
    /**
     * UN SEUL message pour tous les écrans qui refusent un montant.
     *
     * Il ne dit pas OÙ la lecture a buté — espace insécable, virgule décimale,
     * symbole recopié — mais ce qu'il faut faire. La cause n'apprend rien à qui
     * vient de coller « 35 000 FCFA » dans un champ, et cinq libellés taillés
     * écran par écran auraient divergé au premier remaniement.
     */
    amountUnreadable:
      'Montant illisible. Reprenez-le en chiffres positifs, sans lettre ni symbole.',
    /* FORME COURTE POUR LE TÉLÉPHONE, et non une troncature de la longue.
       La bande de démonstration faisait 140 px à 360 px de large : la phrase
       complète y tombait sur quatre lignes, répétées sur les 23 écrans. Couper
       la phrase aurait menti par omission ; en écrire une vraie, plus courte,
       dit la même chose sur une ligne. La longue reste, à partir de `sm`. */
    /* ASSEZ COURTE POUR TENIR ENTIÈRE À 320 px, et c'est la contrainte.
       Première rédaction : « Données fictives : rien n'est enregistré. » —
       mesurée à 230 px pour 155 disponibles une fois la gouttière et le bouton
       déduits, donc rognée en « Données fictives : rien… ». Une phrase coupée
       au milieu d'un mot est exactement le mensonge par omission que la forme
       courte existait pour éviter. Celle-ci tient. */
    /* ELLE NOMME CE QUI EST FICTIF, et c'est ce qui la justifie.
       « Données fictives. » tenait sur une ligne à 320 px et ne disait PAS de
       quoi il s'agissait — le téléphone, appareil du marché visé, recevait la
       version pauvre pendant que le bureau avait la phrase entière. Celle-ci
       nomme les trois choses que l'écran montre. Elle passe sur deux lignes
       sous 700 px : c'est le prix, mesuré à +21 px de coquille, et il est
       moins cher qu'une phrase qui n'apprend rien. */
    demoNoticeShort: 'Immeubles, locataires et montants fictifs.',
    demoNotice:
      'Vous parcourez une démonstration : ces immeubles, ces locataires et ces montants sont fictifs.',
    demoCta: 'Créer mon espace',
    countryGroupServed: 'Pays desservis',
    countryGroupOther: 'Autres pays',
    // La liste couvre désormais le monde entier : ce n'est plus le pays qui
    // manque, c'est la devise et la langue qu'on ne connaît pas pour lui.
    countryOtherHint:
      'Ce pays n’est pas encore desservi : choisissez vous-même la devise et la langue de votre espace.',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    passwordHint: 'Au moins {n} caractères.',
    phone: 'Téléphone',
    dialCode: 'Indicatif téléphonique',
    /**
     * Comptes accordés SÉPARÉMENT, puis composés.
     *
     * Les sous-titres portaient « {buildings} immeubles, {units} unités » avec
     * une seule variante `_one` — or la pluralisation se règle sur un unique
     * `count`, et il y a ici deux noms à accorder. Un parc d'un logement
     * affichait donc « 2 immeubles, 1 unités ». Deux fragments, deux accords,
     * une composition : c'est la seule forme qui tienne dans les deux langues.
     */
    buildingCount: '{count} immeubles',
    buildingCount_one: '{count} immeuble',
    unitCount: '{count} unités',
    unitCount_one: '{count} unité',
    // Le gabarit ne récite PAS un format — « jj/mm/aaaa » serait faux dès
    // qu'on passe en anglais, où l'ordre s'inverse. Le calendrier dit le
    // format en montrant les dates.
    datePlaceholder: 'Choisir une date',
    dateCalendar: 'Calendrier',
    datePrevMonth: 'Mois précédent',
    dateNextMonth: 'Mois suivant',
    dateToday: 'Aujourd’hui',
    dateClear: 'Effacer',
    dateMonth: 'Mois',
    dateYear: 'Année',
    datePrevYear: 'Année précédente',
    dateNextYear: 'Année suivante',
    datePrevYears: 'Douze années précédentes',
    dateNextYears: 'Douze années suivantes',
    monthPlaceholder: 'Choisir un mois',
    monthCalendar: 'Choix du mois',
    monthCurrent: 'Ce mois-ci',
    emailPlaceholder: 'nom@domaine.com',
    fullName: 'Nom complet',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    selectPlaceholder: 'Sélectionner…',
    // Une liste de choix coupée sans un mot laisse conclure que l'entrée
    // cherchée n'existe pas. La phrase dit les deux choses utiles : il en
    // manque, et taper suffit à les faire venir.
    //
    // Courte à dessein : le pied s'affiche dans une liste large de 176px sur
    // l'inscription, où une phrase complète tenait sur quatre lignes et pesait
    // plus que les options qu'elle commente.
    listTruncated: 'Liste raccourcie : affinez votre recherche.',
    period: 'Période',
    perMonth: '/ mois',
    perYear: '/ an',
    yes: 'Oui',
    no: 'Non',
  },

  /* Les trois états de la préférence de thème. « Système » n'est pas une
     troisième palette : c'est le fait de ne pas choisir, et de laisser le
     réglage du système d'exploitation trancher. */
  theme: {
    auto: 'Système',
    autoResolu: 'Système — {resolu} actuellement',
    light: 'Clair',
    dark: 'Sombre',
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
    access: 'Accès au parc',
    tenants: 'Locataires',
    report: 'Signaler',
    alerts: 'Signalements',
    onboarding: 'Prise en main et droits',
    system: 'États du système',
    tenantPortal: 'Portail locataire (web)',
    tenantApp: 'App locataire',
    // Les trois entrées du locataire. « Mon espace » et non « Tableau de
    // bord » : il n'en pilote aucun, il consulte le sien.
    mySpace: 'Mon espace',
    documents: 'Documents',
    sectionMySpace: 'Mon espace',
    sectionSteering: 'Pilotage',
    sectionOperations: 'Opérations',
    sectionAdmin: 'Administration',
    activeProfile: 'Profil actif',
    /* LE POINT D'ENTRÉE UNIQUE DES RÉGLAGES.
       Langue, devise et thème occupaient en permanence la moitié droite de la
       barre sur les 23 écrans, pour des choix qu'on fait une fois — et à 360 px
       les trois segmentés repliaient l'en-tête sur trois lignes, 185 px de
       hauteur avant le moindre contenu. Ils vivent désormais derrière un seul
       bouton, et aucun ne disparaît : le panneau les montre tous les trois. */
    settings: 'Réglages',
    settingsOpen: 'Réglages : langue, devise et thème',
    // Trois boutons portaient ce libellé pour trois actions différentes.
    // « Replier ou déplier » ne vaut que pour la barre latérale de bureau, qui
    // bascule entre pleine largeur et rail ; le tiroir mobile, lui, s'ouvre
    // depuis la barre supérieure et se ferme depuis son propre en-tête.
    toggleNav: 'Replier ou déplier la navigation',
    openNav: 'Ouvrir la navigation',
    closeNav: 'Fermer la navigation',
    searchPlaceholder: 'Rechercher un logement, un locataire…',
    selectPark: 'Parc regardé',
    primaryNav: 'Navigation principale',
    sectionsNav: 'Sections du produit',
    // La barre basse ne porte que quatre destinations : « Plus » ouvre le
    // tiroir, qui reste le seul endroit où la navigation est complète.
    quickNav: 'Navigation rapide',
    more: 'Plus',
  },

  auth: {
    signIn: 'Se connecter',
    signUp: 'Créer un compte',
    signUpFree: 'Essayer gratuitement',
    accountMenu: 'Compte de {name} — ouvrir le menu',
    logout: 'Se déconnecter',
    noAccount: 'Pas encore de compte ?',
    hasAccount: 'Vous avez déjà un compte ?',
    forgotPassword: 'Mot de passe oublié ?',

    login: {
      title: 'Content de vous revoir',
      subtitle: 'Reprenez la main sur votre parc.',
      submit: 'Se connecter',
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
      resent: 'Demande renvoyée',
      wrongEmail: 'Ce n’est pas la bonne adresse ?',
    },

    reset: {
      title: 'Choisissez un nouveau mot de passe',
      subtitle:
        'Toutes vos sessions seront fermées : il faudra vous reconnecter sur chaque appareil.',
      newPassword: 'Nouveau mot de passe',
      confirm: 'Confirmez le mot de passe',
      confirmHint: 'Retapez-le à l’identique.',
      submit: 'Enregistrer le mot de passe',
      successTitle: 'Mot de passe modifié',
      successBody:
        'Vous pouvez vous connecter avec votre nouveau mot de passe. Toutes les sessions ouvertes ont été fermées, y compris celles dont vous n’êtes pas à l’origine.',
      goToLogin: 'Se connecter',
      invalidTitle: 'Ce lien n’est plus valable',
      invalidBody:
        'Un lien de réinitialisation expire au bout d’une heure et ne sert qu’une fois. Demandez-en un nouveau.',
      askAnother: 'Demander un nouveau lien',
    },

    strength: {
      tooShort: 'Trop court',
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

      identityTitle: 'Votre identité',
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
        'Le propriétaire vous le communique depuis son espace. Format : GES-XXXX-XXXX.',

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
      /**
       * Le compte est RÉELLEMENT créé depuis que `creerLeCompte` appelle
       * `inscrire`. Ce texte annonçait pourtant l'inverse — « la création de
       * compte n'est pas encore branchée » — et c'était le dernier vestige de
       * l'époque où l'assistant validait neuf champs puis faisait `setDone`.
       *
       * Le mensonge tombait au pire moment : juste après avoir saisi une
       * adresse, un mot de passe et un numéro réels, l'écran affirmait que rien
       * n'avait été enregistré. Un utilisateur qui le croit recommence, ou
       * renonce. Le premier compte du produit a été créé sous cette phrase.
       */
      successBody:
        'Votre compte est créé et vous y êtes déjà connecté. Voici votre espace {role}, encore vide.',
      goToDashboard: 'Ouvrir le tableau de bord',

      // Une seule issue de correction par groupe, donc un libellé qui dit LEQUEL
      // — « Modifier » répété trois fois ne se distingue pas à l'oreille.
      editSection: 'Modifier : {section}',

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
      passwordChoose: 'Choisissez un mot de passe.',
      passwordEnter: 'Saisissez votre mot de passe.',
      passwordShort: 'Utilisez au moins {n} caractères.',
      phoneRequired: 'Indiquez un numéro de téléphone.',
      phoneInvalid: 'Ce numéro semble incomplet.',
      // Le message dit la CAUSE et la limite : « invalide » laisserait
      // l'utilisateur retaper le même numéro sans savoir ce qui cloche.
      phoneTooLong: 'Ce numéro est trop long, indicatif compris.',
      parkNameRequired: 'Donnez un nom à votre parc.',
      inviteRequired: 'Saisissez votre code d’invitation.',
      inviteInvalid: 'Code non reconnu. Format attendu : LOC-XXXX-XXXX pour un locataire, GES-XXXX-XXXX pour un gestionnaire.',
      countryRequired: 'Choisissez votre pays.',
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
      /**
       * Le produit ne sait ni recevoir un fichier déposé, ni fabriquer un PDF
       * opposable. Annoncer « PDF » sur une case vide inventerait la pièce que
       * le bouton prétend restituer — le défaut que le portail a déjà payé.
       */
      none: 'Aucun document déposé',
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
      vsPrevious: 'vs. {amount} le mois dernier',
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
      decisionDeposit: 'Caution à arbitrer · {tenant}',
      decisionsEmpty: 'Rien à arbitrer pour le moment.',
      scheduleTitle: 'Échéancier',
      scheduleEmptyTitle: 'Aucune échéance en attente',
      scheduleEmptyBody:
        'Tous les loyers appelés ont été encaissés. Cette liste se remplit d’elle-même dès qu’une échéance passe la date d’exigibilité.',
      breakdownTitle: 'Répartition du parc',
      legendRent: 'Loyer',
      legendWater: 'Eau',
      legendPower: 'Électricité',
      scalePrimary: 'Échelle principale (loyer)',
      scaleSecondary: 'Échelle secondaire (eau, électricité)',
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
      kpiDepositNote: 'à restituer en fin de bail',
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
      /**
       * Le sous-titre récitait « Trois immeubles, douze unités » — les chiffres
       * du jeu de DÉMONSTRATION, écrits en dur, servis à tout parc réel. Un
       * compte neuf ouvrait donc « Parc immobilier » sur une phrase qui lui
       * annonçait douze logements qu'il n'a pas.
       */
      subtitle: '{buildings}, {units}. Le statut porte sur le mois affiché.',
      // Aucun logement du tout : ce n'est pas une recherche infructueuse.
      deleteBuilding: 'Supprimer l’immeuble {name}',
      deleteBuildingTitle: 'Supprimer {name} ?',
      deleteBuildingBody:
        'Cet immeuble ne porte aucun logement. La suppression est définitive.',
      deleteBuildingDone: 'Immeuble supprimé',
      emptyTitle: 'Aucun logement pour l’instant',
      emptyBody: 'Déclarez un immeuble, puis ajoutez-y vos logements.',
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
      removePayment: 'Retirer ce versement',
      paymentRemoved: 'Versement retiré · la dette est rétablie',
      removeTitle: 'Retirer ce versement de {amount} ?',
      removeBody:
        'Encaissé le {date}. Le retirer fait réapparaître la dette : c’est de l’argent qu’on déclare ne plus avoir reçu. Le journal en garde la trace.',
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
      overdueDays: '+{days} j',
      /* Relance et mise en demeure — la promesse de la grille tarifaire. */
      callRent: 'Appeler les loyers',
      rentCalled: '{count} échéances émises pour ce mois',
      rentCalled_one: '1 échéance émise pour ce mois',
      rentAlreadyCalled: 'Les loyers de ce mois ont déjà été appelés',
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
      notice: 'Mettre en demeure',
      noticeTitle: 'Mettre en demeure {tenant} ?',
      noticeBody:
        'Acte engageant, qui précède la résiliation. Le motif et le montant dû sont figés au dossier et seront produits en cas de litige.',
      noticeReason: 'Motif',
      noticeReasonHint: 'Au moins 10 caractères. C’est le texte qui défendra la décision.',
      noticeReasonError: 'Un motif d’au moins 10 caractères est requis',
      noticeDone: 'Mise en demeure enregistrée au dossier du bail',
      // En-tête de colonne de l'export : « +24 j » est une abréviation
      // d'affichage, illisible en tête d'une colonne de tableur.
      lateDays: 'Jours de retard',
    },

    tariffs: {
      title: 'Prix de refacturation',
      description:
        'L’eau et l’électricité sont refacturées à ces prix. Sans eux, les relevés s’affichent en quantités, sans montant.',
      utility: 'Énergie',
      price: 'Prix unitaire',
      priceHint: 'Par mètre cube pour l’eau, par kilowattheure pour l’électricité.',
      demoNoSave:
        'La démonstration n’enregistre pas de prix : ceux de l’historique sont ceux qu’elle applique à ses relevés, et ils ne quittent pas la visite.',
      priceInvalid: 'Saisissez un prix entier supérieur à zéro.',
      effectiveFrom: 'À partir du',
      effectiveFromHint:
        'Un prix ne vaut pas pour le passé : les relevés antérieurs gardent celui qui était en vigueur.',
      submit: 'Enregistrer ce prix',
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
      currencyWarning:
        'Les montants déjà saisis ne seront pas convertis : 180 000 se relira 180 000 dans la nouvelle devise. À ne faire que sur un parc dont les montants seront resaisis.',
      unchanged: 'Rien n’a changé.',
      saved: 'Parc corrigé',
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
      noPrice: 'Tarif non fixé',
      missingCount: '{count} relevés manquants pour la période',
      missingCount_one: '{count} relevé manquant pour la période',
      missingHint: 'La facturation du mois restera incomplète tant qu’ils ne sont pas saisis.',
      complete: 'Tous les relevés sont saisis pour la période.',
      totalRebilled: 'Total refacturé',
      capturedCount: '{done} sur {total} saisis',
    },

    inspections: {
      record: 'Établir un état des lieux',
      recordBody: 'Entrée ou sortie, pièce par pièce. Les réserves d’entrée ne se chiffrent pas : elles constatent ce qui est déjà abîmé, pour que le locataire n’en réponde pas.',
      recorded: 'État des lieux enregistré',
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
      removeFinding: 'Retirer la réserve n° {rank}',
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
      entry: 'Entrée',
      exit: 'Sortie',
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
      reported: 'Signalé',
      quoted: 'Devis proposé',
      approved: 'Validé',
      done: 'Terminé',
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
      filterOrigin: 'Trier par origine',
      filterAll: 'Toutes',
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
      replyTitle: 'Répondre au locataire',
      replyBody: 'Votre réponse arrive dans ses notifications, rattachée au signalement {reference}.',
      replyTo: 'Destinataire : {name}',
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
      /* Les trois cartes étaient NUES — un intitulé, un montant, rien dessous —
         quand celles des cinq autres écrans portent une ligne qui dit sur quoi
         le montant porte. « 1 226 000 FCFA » ne disait pas sur combien de
         cautions. */
      kpiHeldNote: 'sur {count} cautions',
      kpiHeldNote_one: 'sur {count} caution',
      kpiWithheldNote: '{count} en cours d’arbitrage',
      kpiWithheldNote_one: '{count} en cours d’arbitrage',
      kpiBalanceNote: '{count} déjà restituées',
      kpiBalanceNote_one: '{count} déjà restituée',
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
      memberRole: 'Rôle',
      since: 'Membre depuis',
      action: 'Action',
      role_owner: 'Propriétaire',
      role_manager: 'Gestionnaire',
      role_tenant: 'Locataire',
      revokeMember: 'Retirer l’accès',
      memberRevoked: 'Accès retiré',
      invitesTitle: 'Codes en attente',
      invitesHint:
        'Un code vaut quatorze jours et ne sert qu’une fois. Reprenez celui que vous avez transmis par erreur.',
      code: 'Code',
      expires: 'Valable jusqu’au',
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
      managerNotice:
        'Seul le propriétaire recrute un gestionnaire. Vous invitez des locataires.',
      unit: 'Logement concerné',
      unitHint:
        'Le locataire rejoindra ce logement. Sans logement, il rejoint le parc sans bail — vous l’y rattacherez ensuite.',
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
      contact: 'Contact',
      remove: 'Retirer',
      removeTitle: 'Retirer la fiche de {name} ?',
      removeBody: 'Le bail et les échéances appelées partent avec elle ; le logement redevient vacant. Refusé si un versement a été encaissé ou une caution détenue — retirez-les d’abord.',
      removeUnit: 'Logement {unit}',
      removed: 'Fiche retirée · le logement est vacant',
      vacantList: '{count} unités vacantes : {units}',
      vacantList_one: '{count} unité vacante : {units}',
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

    onboarding: {
      changeInSettings: 'Modifier dans les réglages du parc',
      delegationOffNotice: 'Ce parc est en gestion seule : aucun code de gestionnaire n’est émis. Changez la politique de délégation pour en recruter un.',
      joinTitle: 'Rejoindre un parc',
      joinBody: 'Si votre propriétaire ou gestionnaire vous a remis un code, saisissez-le ici : votre compte sera rattaché à son parc, au rôle qu’il vous a accordé.',
      join: 'Rejoindre',
      joined: 'Parc rejoint · votre espace est à jour',
      joinRefused: 'Ce code ne peut pas être utilisé. Vérifiez-le, ou demandez-en un nouveau.',
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
      managerOffNote:
        'Ces droits n’existent que si le parc est en gestion déléguée.',
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

    crash: {
      title: 'Cet écran s’est interrompu',
      body:
        'Une erreur a arrêté l’affichage. Le reste de l’application fonctionne : réessayez, ou revenez à l’accueil.',
      details: 'Détail technique',
    },

    sessionFailure: {
      title: 'Impossible d’ouvrir votre espace',
      body:
        'Le serveur a répondu, mais pas ce qu’il fallait. Votre session n’est pas perdue — réessayez dans un instant.',
      timeoutBody:
        'Le serveur n’a pas répondu à temps. La connexion est peut-être lente : réessayez, ou revenez plus tard.',
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
      // « Rejouer » et non « Recharger » : rien n'est demandé au serveur, on
      // remontre un état. Le verbe dit qu'on est dans une vitrine.
      replayLoading: 'Rejouer le chargement',
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
      // Au-delà de `lg` la barre porte déjà ses liens : le même bouton n'ouvre
      // plus qu'un panneau de réglages, et son nom doit le dire.
      openSettings: 'Ouvrir les réglages',
      closeSettings: 'Fermer les réglages',
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
      // Le pourcentage s'écrit avec une espace avant le signe en français et
      // sans en anglais. Trois d'entre eux étaient écrits en dur dans
      // `Hero.tsx` — donc servis à la française sur la page anglaise, la
      // première qu'un visiteur anglophone voit. C'est le défaut que la note
      // ci-dessous rapporte déjà pour le compte de locataires : il avait
      // survécu à la passe qui l'a corrigée.
      percent: '{value} %',
      // Effectif sous le taux : dix logements occupés sur douze. Séparé du
      // pourcentage parce qu'un lecteur qui doute du taux veut le rapport qui
      // le fonde, pas une seconde formulation du même chiffre.
      occupancyNote: '{occupied} / {total}',
      overdue: 'Reste à percevoir',
      // Écrit en dur dans `Hero.tsx`, donc servi tel quel sur la page d'accueil
      // en anglais. Une maquette qui dépeint le produit doit se traduire comme
      // lui — c'est la première page qu'un visiteur anglophone voit.
      overdueNote: '{count} locataires',
      overdueNote_one: '{count} locataire',
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
        body: 'E-mail déclenché à J+1, J+7, J+15. Vous fixez le ton, le produit tient le calendrier. Automatiques à partir du palier Pro.',
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
      andMore: 'et {count} autres',
      andMore_one: 'et {count} autre',
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
        managersUnlimited: 'illimité',
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
      // `company`, `legal`, `about`, `contact`, `terms`, `privacy` et
      // `cookies` sont partis avec les liens qu'ils nommaient : ils
      // promettaient des pages que ce dépôt n'a pas. Une chaîne traduite qui
      // n'est plus rendue nulle part est un orphelin de plus, et le
      // dictionnaire est justement l'endroit où l'on ne s'en aperçoit jamais.
      // Voir le relevé lien par lien en tête de `PublicFooter.tsx`.
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
