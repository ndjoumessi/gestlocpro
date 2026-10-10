/**
 * Dictionnaire français — source de vérité de la forme des clés.
 * `en.ts` est typé contre lui : toute clé ajoutée ici doit y être traduite,
 * sinon la compilation échoue.
 *
 * Interpolation : `{nom}` est remplacé par la variable passée à `t()`.
 *
 * ═══ CE FICHIER EST LE CÔTÉ IMPATIENT, ET IL NE PORTE PLUS `app` ═══
 *
 * Tout ce qui est écrit ici part sur le fil avec la page d'accueil, pour
 * quiconque l'ouvre. La section `app` — les mots des écrans de gestion, 20 223 o
 * compressés à elle seule — vit depuis le 2026-10-09 dans `fr-app.ts`, chargé
 * par la promesse de l'espace applicatif. Son en-tête dit pourquoi, et quelle
 * garde ferme le trou que la scission ouvre.
 *
 * UNE CHAÎNE AJOUTÉE ICI SE PAIE SUR LA VITRINE. Une chaîne d'écran applicatif
 * va dans `fr-app.ts`, et n'y coûte rien à qui ne s'y rend pas.
 */
import type { frApp } from './fr-app'

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
    currencyUnavailable: 'Cours indisponibles · montants en {currency}',
    currencyConverted: 'Convertis au taux du {date}',
    currencyPegged: 'Convertis à la parité légale',
    demoPark: 'Parc de démonstration',
    emptyParkTitle: 'Votre parc est encore vide',
    emptyParkBody:
      'Les indicateurs, les encaissements et les relances apparaîtront ici dès que votre parc portera des logements. Commencez par déclarer un immeuble.',
    emptyParkDemo: 'Voir ce que donne un parc rempli',
    newVersion: 'Une nouvelle version de GestLocPro est disponible.',
    newVersionReload: 'Recharger',
    actionRefused: 'Le serveur a refusé cette action. Rien n’a été enregistré.',
    actionFailed: 'Action impossible pour l’instant. Rien n’a été enregistré.',
    /* Un délai dépassé ne dit PAS « rien n'a été enregistré » : le serveur a
       peut-être écrit avant que sa réponse ne se perde. On demande de vérifier
       avant de ressaisir, pas de recommencer. */
    actionTimedOut:
      'Le serveur n’a pas répondu à temps. Vérifiez si l’opération apparaît avant de la ressaisir.',
    actionOffline: 'Vous êtes hors ligne. Rien n’a été envoyé ; votre saisie est conservée.',
    offlineBanner:
      'Hors ligne. Vous pouvez consulter, mais rien ne partira tant que la connexion n’est pas revenue.',
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
    // LE PLACEHOLDER DU MOT DE PASSE MONTRE UNE FORME, il ne redit pas
    // l'étiquette. C'est la règle que `emailPlaceholder` suit déjà juste
    // au-dessus : « nom@domaine.com » est un EXEMPLE, pas le mot « courriel »
    // recopié. La forme d'un mot de passe saisi est une suite de points, et
    // c'est ce que le champ montre au repos.
    //
    // Il vit au dictionnaire plutôt qu'en dur dans `Login.tsx` — la garde des
    // chaînes en dur l'exigerait de toute façon — et cela le rend réglable :
    // une langue qui masquerait autrement n'aurait qu'à changer la valeur.
    passwordPlaceholder: '••••••••',
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
    /* LA LISTE VIDE — voir `Combobox` : elle rendait un tiret muet sous la
       promesse d'un mot. */
    /* LE NOM, NON MONTRÉ, DE LA COLONNE DE GESTES — voir `DataTable` : cinq
       écrans y déclarent un en-tête vide, ce qui est juste à l'œil et laisse un
       trou dans la liste des en-têtes par laquelle on s'oriente au lecteur
       d'écran. */
    rowActions: 'Gestes',
    listEmpty: 'Aucun résultat pour cette recherche.',
    /* LA FRAPPE REFUSÉE — voir `useSaisieFiltree` : le champ absorbait la
       touche en silence, et la contrainte n'était écrite nulle part. */
    /* LA PLAGE D'UN SÉLECTEUR DE MOIS — voir `MonthPicker` : les mois fermés
       disaient QUE c'était fermé, jamais jusqu'où. */
    monthRange: 'Choix possible de {debut} à {fin}.',
    /* UNE SEULE BORNE QUAND LES DEUX SE CONFONDENT. `monthRange` rendait
       « de Septembre 2026 à Septembre 2026 » — deux bornes identiques récitées
       comme un intervalle —, et c'est la fenêtre la PLUS FRÉQUENTE du produit :
       la démonstration resserre min et max sur le mois du dernier relevé. */
    monthOnly: 'Seul {debut} est possible.',
    monthFrom: 'Choix possible à partir de {debut}.',
    monthUntil: 'Choix possible jusqu’à {fin}.',
    onlyDigits: 'Ce champ n’accepte que des chiffres.',
    onlyPhone: 'Ce champ n’accepte que des chiffres et le signe plus.',
    period: 'Période',
    perMonth: '/ mois',
    perYear: '/ an',
    yes: 'Oui',
    no: 'Non',

    /* ═══ CE QUE LE PAQUET D'ENTRÉE PRONONCE ═══

       Les deux groupes ci-dessous vivaient sous `app.`, et ils en sont sortis le
       2026-10-09 parce que la section `app` est devenue PARESSEUSE : elle arrive
       avec l'espace applicatif. Un module du paquet d'entrée qui y puise
       afficherait sa clé en toutes lettres — `check-dictionnaire-impatient.mjs`
       le refuse désormais, et c'est lui qui a nommé ces cinq clés.

       Ils ne sont pas « communs » par commodité de rangement : chacun est
       prononcé des DEUX côtés de la frontière. */

    /* L'écran de panne. `FrontiereDErreur` est montée au-dessus de TOUT, y
       compris de la vitrine, et le cas où elle sert est précisément celui où un
       morceau n'a pas pu se charger : ses mots ne peuvent pas vivre dans un
       morceau. */
    crash: {
      title: 'Cet écran s’est interrompu',
      body:
        'Une erreur a arrêté l’affichage. Le reste de l’application fonctionne : réessayez, ou revenez à l’accueil.',
      details: 'Détail technique',
    },

    /* Le graphe des encaissements, rendu par `Hero` sur la page d'accueil ET
       par le tableau de bord. Les deux montrent la même figure ; ils la
       nommaient par une clé rangée chez le second. */
/* Le pied des documents convertis. `AnnoncePublique` le prononce, et c'est une
       DESTINATION publique, pas un écran de gestion : ses mots ne peuvent pas
       vivre dans le morceau des écrans. Le dossier applicatif l'emploie aussi. */
    pdfConverted: 'Montants convertis depuis le {currency} au taux du {date} : {rate}.',
    pdfConvertedPegged: 'Montants convertis depuis le {currency} à la parité légale : {rate}.',

    chart: {
      /* LE COMPTE VIENT DE LA DONNÉE, et il ne le faisait pas. « 12 mois » était
         écrit en dur au-dessus d'un graphe qui ne rend que les périodes PORTANT
         une échéance : un parc ouvert en août en montrait deux sous un titre qui
         en promettait douze. */
      title: 'Encaissements sur {count} mois',
      title_one: 'Encaissements du mois',
      // Portée dans l'infobulle de la dernière colonne : sans elle, le creux
      // du mois courant se lit comme une chute d'encaissement.
      openMonth: 'Mois en cours, encore ouvert.',
    },
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
    /* « À ÉCHOIR » ET NON « EN ATTENTE » : le loyer est appelé, sa date n'est
       pas venue. « En attente » ne disait pas de quoi, sur un écran dont la
       bannière parle de comptes — et il a été lu « en attente d'un compte ». */
    pending: 'À échoir',
    /* Rien n'a été appelé pour ce mois : c'est un geste à faire, pas une
       attente. Voir `statut()` côté serveur. */
    uncalled: 'Non appelé',
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
    /* Les libellés courts de la barre basse : un mot, SEPT signes au plus —
       « Paiements » (neuf) et « Payments » (huit) se coupaient à 320 px, mesuré. */
    dashboardShort: 'Accueil',
    portfolio: 'Parc immobilier',
    portfolioShort: 'Parc',
    payments: 'Paiements',
    paymentsShort: 'Loyers',
    meters: 'Relevés',
    inspections: 'États des lieux',
    works: 'Travaux',
    deposits: 'Cautions',
    expenses: 'Dépenses',
    vacancy: 'Vacance',
    access: 'Accès au parc',
    tenants: 'Locataires',
    report: 'Signaler',
    alerts: 'Signalements',
    alertsShort: 'Alertes',
    onboarding: 'Prise en main et droits',
    /* COURT, et c'est la contrainte de la barre : « Manuel d'utilisation » est
       le titre de l'écran, pas son entrée de navigation. */
    manual: 'Manuel',
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
    decisions: 'Décisions',
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
    settingsClose: 'Fermer les réglages',
    // Trois boutons portaient ce libellé pour trois actions différentes.
    // « Replier ou déplier » ne vaut que pour la barre latérale de bureau, qui
    // bascule entre pleine largeur et rail ; le tiroir mobile, lui, s'ouvre
    // depuis la barre supérieure et se ferme depuis son propre en-tête.
    toggleNav: 'Replier ou déplier la navigation',
    openNav: 'Ouvrir la navigation',
    closeNav: 'Fermer la navigation',
    /*
      « AU SITE » ET NON « À L'ACCUEIL ».

      La coquille a déjà un accueil — le tableau de bord, première entrée de la
      navigation, et destination du logo. Un second libellé « Accueil » dans la
      même barre désignerait un autre lieu sous le même mot, ce qui est le
      défaut que le fil d'Ariane a coûté une fois ici. « Le site » nomme ce
      qu'on quitte l'application pour retrouver : la vitrine publique.
    */
    threadEmailCopies: 'Copies des signalements',
    threadEmailDigest: 'Les grouper en un résumé',
    myData: 'Mes données',
    newsletter: 'Nouveautés produit par e-mail',
    backToSite: 'Retour au site',
    /* LE CHEMIN DU RETOUR, et il n'existait pas. « Retour au site » emmène du
       produit vers la vitrine ; rien ne ramenait. L'en-tête public servait ses
       deux boutons d'entrée à quelqu'un déjà entré — voir
       `sessionVivanteSurLeSitePublic.test.tsx`. */
    backToApp: 'Reprendre mon espace',
    searchPlaceholder: 'Rechercher un logement, un locataire…',
    /* Le GABARIT, plus court que le nom accessible : voir `Portfolio`. */
    searchShort: 'Logement, locataire…',
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
    /*
      LE MENU SE NOMME AUTREMENT QUE SON DÉCLENCHEUR, et il le faut.

      Le déclencheur nomme un GESTE — « ouvrir le menu » —, ce qui est juste sur
      un bouton. Posé sur le panneau lui-même, ce libellé s'annonçait « Compte
      de Sarah Ngassa — ouvrir le menu, menu, 2 éléments » : le menu ouvert
      proposait de s'ouvrir. Celui-ci ne nomme que la chose, parce qu'une fois
      là on n'a plus rien à ouvrir — on a la réponse à « qui est connecté ? »,
      seule raison d'être de ce panneau.
    */
    accountOf: 'Compte de {name}',
    logout: 'Se déconnecter',
    noAccount: 'Pas encore de compte ?',
    hasAccount: 'Vous avez déjà un compte ?',
    forgotPassword: 'Mot de passe oublié ?',

    login: {
      closureNotice:
        'Votre compte sera effacé le {date}. Reconnectez-vous avant cette date pour annuler la demande.',
      title: 'Content de vous revoir',
      subtitle: 'Reprenez la main sur votre parc.',
      submit: 'Se connecter',
      remember: 'Rester connecté sur cet appareil',
      rememberHint: 'Décochez sur un poste partagé : la session se ferme au bout de douze heures.',
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
        'Indiquez l’adresse de votre compte. Nous vous envoyons un lien de réinitialisation valable {minutes} minutes.',
      submit: 'Envoyer le lien',
      backToLogin: 'Revenir à la connexion',
      sentTitle: 'Vérifiez votre boîte mail',
      sentBody:
        'Si un compte existe pour {email}, un lien de réinitialisation vient d’y être envoyé. Pensez à regarder dans les indésirables.',
      /* LE DÉLAI, SUR L'ÉCRAN OÙ IL SERT. Il n'était écrit que dans le
         sous-titre d'AVANT l'envoi, que ce même écran vient de remplacer : on
         attend son courriel devant une page qui ne dit plus ni combien de temps
         le lien vaut, ni quoi faire ensuite. */
      sentDelay:
        'Le lien reste valable {minutes} minutes et ne sert qu’une fois. Passé ce délai, demandez-en un nouveau.',
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
        'Un lien de réinitialisation expire au bout de {minutes} minutes et ne sert qu’une fois. Demandez-en un nouveau.',
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

      roleRequired: 'Choisissez le rôle qui vous correspond pour continuer',
      inviteCode: 'Code d’invitation',
      /* Un GABARIT, et il vaut mieux qu'il soit réel : « LOC-XXXX-XXXX »
         apprend la longueur, « LOC-4A7B-92CD » apprend en plus qu'on peut y
         mettre des chiffres. Les deux écrans qui demandent ce code en
         montraient deux formes différentes, dont une écrite en dur. */
      inviteCodePlaceholder: 'LOC-4A7B-92CD',
      inviteCodeHint:
        'Vous l’avez reçu par SMS ou par e-mail à la signature de votre bail. Format : LOC-XXXX-XXXX.',
      tenantNotice:
        'Un locataire ne crée pas son espace seul : il est rattaché à un bail existant. Sans code, demandez-le à votre gestionnaire.',

      // DEUX VERBES, ET C'EST LA RÈGLE QUI LES SÉPARE. On ACCEPTE des conditions
      // générales — elles engagent. On LIT une politique de confidentialité —
      // elle informe, et rien ne s'y signe. `efd8654` avait retiré les
      // conditions parce qu'elles n'existaient pas ; `51daf49` les a publiées,
      // elles reviennent ici. Voir `caseDeConfidentialite.test.tsx`.
      termsAcceptLead: 'J’accepte les',
      termsAcceptLink: 'conditions générales',
      termsReadLead: 'et j’ai lu la',
      termsLink: 'politique de confidentialité',
      termsNewTab: '(s’ouvre dans un nouvel onglet)',
      termsError:
        'Acceptez les conditions générales et confirmez avoir lu la politique de confidentialité pour créer votre compte.',
      // Posée sur le champ e-mail, à l'étape « Vos informations » : l'afficher
      // sur le récapitulatif la mettrait là où le champ n'existe pas.
      emailTaken: 'Un compte existe déjà avec cette adresse. Connectez-vous, ou utilisez-en une autre.',
      errorOffline: 'Le serveur est injoignable. Vos réponses sont conservées : réessayez.',
      errorUnexpected: 'La création du compte a échoué. Vos réponses sont conservées : réessayez.',
      // Sans rythme promis : aucune lettre n’existe encore, et « une fois par
      // trimestre » engageait un envoi que rien ne tient — voir
      // `caseDeConfidentialite.test.tsx`.
      newsletter: 'Recevoir les nouveautés produit par e-mail, sans revente de données.',

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
      /**
       * LE COMPTE EST CRÉÉ, LA SESSION NE S'EST PAS OUVERTE.
       *
       * L'inscription relit la session après la création — `/auth/me` — et ce
       * second appel peut échouer quand le premier a réussi. Le compte existe
       * alors pour de bon, mais rien n'est ouvert : annoncer « vous y êtes déjà
       * connecté » serait le mensonge symétrique de celui que `successBody`
       * raconte plus haut, et il enverrait sur une route gardée.
       *
       * La phrase dit les deux choses utiles, dans l'ordre où elles servent : ce
       * qui est acquis — le compte, avec l'adresse à laquelle se connecter —, et
       * le geste qui reste. Elle ne nomme PAS la cause : « le réseau », « le
       * serveur » ou « la session » ne changent rien à ce qu'il y a à faire.
       */
      successBodyNoSession:
        'Votre compte est créé, mais la session n’a pas pu s’ouvrir. Connectez-vous avec {email} pour entrer dans votre espace {role}.',

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
      phoneCountry: 'Ce numéro ne correspond pas au format du pays choisi.',
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


  /**
   * LES MENTIONS LÉGALES. Les LIBELLÉS seulement : les valeurs sont des faits du
   * registre, qui ne se traduisent pas — voir `src/legal/editeur.ts`.
   */
  /*
    L'ANNONCE PUBLIQUE — la page qu'un prospect lit sans compte.

    SON PROPRE BLOC DE PREMIER NIVEAU, et non une branche d'`app` : `app` est
    l'espace connecté, et ces libellés sont les seuls du produit qui s'adressent
    à quelqu'un qui n'est ni bailleur, ni gestionnaire, ni locataire.
  */
  listing: {
    title: 'Logement à louer',
    /* LE TITRE DE L'ONGLET PORTE LE LOGEMENT ET LE QUARTIER : c'est ce qu'on
       lit dans une liste d'onglets, et c'est aussi ce qui s'affiche quand on
       partage le lien dans une conversation. */
    titleFor: '{unit} · {district} — à louer',
    heading: '{type} à louer · {district}',
    whereLine: '{building}, logement {unit}',
    rent: 'Loyer mensuel',
    deposit: 'Caution',
    surface: 'Surface',
    surfaceValue: '{n} m²',
    availableFrom: 'Disponible à partir du',
    /* CE QUE LA PAGE NE SAIT PAS FAIRE, dit à l'endroit où on le cherche. Elle
       renvoie vers qui a envoyé le lien, parce que c'est la vérité du produit :
       aucun formulaire de candidature, faute de limiteur de cadence. */
    howToApply:
      'Pour visiter ou postuler, répondez à la personne qui vous a transmis ce lien. Cette page ne reçoit pas de candidature.',
    /* « ABSENTE OU PLUS PUBLIÉE », et les deux sont dans la même phrase parce
       que le serveur rend le même 404 pour les deux — à dessein : distinguer
       ferait de la route un détecteur de logements qui se libèrent. */
    goneTitle: 'Cette annonce n’est plus disponible',
    goneBody:
      'Elle a peut-être été retirée, ou le logement est reloué. Demandez un lien à jour à la personne qui vous a transmis celui-ci.',
    failedTitle: 'L’annonce n’a pas pu être chargée',
    failedBody: 'Ce n’est pas un logement reloué : le service n’a pas répondu. Réessayez dans un instant.',
  },
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
    anchorHint: 'Chaque rubrique a son adresse : ouvrez-la pour en citer le lien.',
    updatedOn: 'Inscription à jour au {date}',
    /* LA DATE DU DOCUMENT, distincte de celle de l'immatriculation juste
       au-dessus — voir `MentionsLegales.tsx`. */
    pageUpdatedOn: 'Page à jour au {date}',
    hosting: 'Hébergement',
    hostName: 'Raison sociale',
    phone: 'Téléphone',
    email: 'Courriel',
    home: 'Retour à l’accueil',
    footerLink: 'Mentions légales',
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
    footerLink: 'Confidentialité',
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
    footerLink: 'Conditions',

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

    how: {
      eyebrow: 'Mise en route',
      title: 'Trois étapes, puis le registre tient tout seul',
      subtitle:
        'La saisie initiale est la seule qui vous coûte du temps. Ce qui suit est du quotidien, et le produit en garde la trace.',
      park: {
        title: 'Décrivez le parc',
        body: 'Immeubles, unités, baux en cours, index de compteurs au jour de la reprise. Une saisie, une fois.',
      },
      invite: {
        title: 'Invitez ceux qui l’occupent',
        body: 'Le locataire reçoit un code rattaché à son logement ; le gestionnaire reçoit les droits que vous lui laissez.',
      },
      run: {
        title: 'Encaissez, relancez, arbitrez',
        body: 'Quittance à chaque règlement, relance à l’échéance, état des lieux comparé à la sortie, caution soldée pièce par pièce.',
      },
    },

    proof: {
      eyebrow: 'Ce qui vous engage',
      title: 'Quatre engagements, et aucun n’a d’astérisque',
      trial: {
        title: 'Trente jours sans carte bancaire',
        body: 'L’essai ne demande aucun moyen de paiement et ne se reconduit pas de lui-même.',
      },
      commission: {
        title: 'Aucune commission sur les loyers',
        body: 'Vous payez l’abonnement et les unités gérées. Ce qui passe par le registre ne nous concerne pas.',
      },
      exportable: {
        title: 'Vos données sortent quand vous voulez',
        body: 'Export CSV et PDF de l’intégralité du registre, quittances et états des lieux compris. Sans période de rétention.',
      },
      rights: {
        title: 'Les droits sont séparés, pas partagés',
        body: 'Le gestionnaire opère, le propriétaire arbitre, le locataire consulte. Personne ne voit le parc d’un autre.',
      },
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
      vatNote: 'TVA non applicable, article 293 B du CGI.',
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

/**
 * La forme ENTIÈRE, les deux moitiés réunies — c'est elle que `t()` consulte, et
 * c'est d'elle que `MessageKey` dérive. Un écran applicatif nomme donc
 * `app.portfolio.title` sans savoir de quel côté de la frontière de CHARGEMENT
 * ces mots vivent, ni dans quelle langue.
 *
 * CE QUE DISAIT CETTE PROSE, ET POURQUOI ELLE A CHANGÉ. Elle affirmait que la
 * forme « ne doit pas se scinder avec le chargement : l'anglais reste un seul
 * fichier ». C'était vrai du lot qui l'a écrite, et c'est faux depuis que
 * `en-app.ts` existe. La forme ENTIÈRE n'a pas bougé pour autant — ce sont les
 * deux formes de MOITIÉ, ci-dessous, qui ont été ajoutées à côté d'elle. Un
 * dictionnaire se type contre le français moitié par moitié ; il se LIT entier.
 */
export type Dictionary = DictionaryShape<typeof fr & typeof frApp>

/**
 * La moitié qui part avec la vitrine — ce que `en.ts` doit traduire.
 *
 * Le typage reste la garde la moins chère du dépôt : une clé ajoutée ici sans
 * traduction anglaise rougit à la compilation, avant toute exécution. La
 * scission anglaise ne lui retire rien, elle la découpe en deux contrats.
 */
export type DictionaryVitrine = DictionaryShape<typeof fr>

/** La moitié qui part avec les écrans — ce que `en-app.ts` doit traduire. */
export type DictionaryApp = DictionaryShape<typeof frApp>
