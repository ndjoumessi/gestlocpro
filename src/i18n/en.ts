import type { DictionaryVitrine } from './fr'

export const en: DictionaryVitrine = {
  brand: {
    name: 'GestLocPro',
    tagline: 'Rental management, held like an estate',
  },

  common: {
    anchorHint: 'Every section has its own address: open one to quote its link.',
    back: 'Back',
    backToHome: 'Back to home',
    skipToContent: 'Skip to content',
    next: 'Continue',
    cancel: 'Cancel',
    save: 'Save',
    edit: 'Edit',
    close: 'Close',
    closeNotification: 'Dismiss notification',
    undo: 'Undo',
    confirm: 'Confirm',
    retry: 'Try again',
    search: 'Search',
    moreActions: 'More actions',
    loading: 'Loading…',
    required: 'required',
    optional: 'optional',
    currency: 'Currency',
    currencyNames: {
      CFA: 'CFA franc (FCFA)',
      EUR: 'Euro (€)',
      CAD: 'Canadian dollar ($)',
      USD: 'US dollar ($)',
    },
    language: 'Language',
    theme: 'Theme',
    country: 'Country',
    dialZoneCfa: 'CFA franc zone',
    dialZoneOther: 'Other countries',
    demoBadge: 'Demo',
    currencyUnavailable: 'Rates unavailable · amounts in {currency}',
    currencyConverted: 'Converted at the {date} rate',
    currencyPegged: 'Converted at the legal parity',
    demoPark: 'Demo portfolio',
    emptyParkTitle: 'Your portfolio is still empty',
    emptyParkBody:
      'Indicators, collections and reminders will appear here as soon as your portfolio holds units. Start by adding a building.',
    emptyParkDemo: 'See what a full portfolio looks like',
    newVersion: 'A new version of GestLocPro is available.',
    newVersionReload: 'Reload',
    actionRefused: 'The server refused this action. Nothing was saved.',
    actionFailed: 'This action failed for now. Nothing was saved.',
    actionTimedOut:
      'The server did not answer in time. Check whether the operation appears before entering it again.',
    actionOffline: 'You are offline. Nothing was sent; your entry is kept.',
    offlineBanner: 'Offline. You can browse, but nothing will be sent until the connection is back.',
    amountUnreadable:
      'Amount unreadable. Re-enter it in positive digits, without letters or symbols.',
    demoNoticeShort: 'Buildings, tenants and amounts are fictional.',
    demoNotice:
      'You are browsing a demo: these buildings, tenants and amounts are fictional.',
    demoCta: 'Create my space',
    countryGroupServed: 'Supported countries',
    countryGroupOther: 'Other countries',
    countryOtherHint:
      'This country is not supported yet: choose the currency and language of your space yourself.',
    email: 'Email address',
    password: 'Password',
    passwordHint: 'At least {n} characters.',
    phone: 'Phone',
    dialCode: 'Dial code',
    buildingCount: '{count} buildings',
    buildingCount_one: '{count} building',
    unitCount: '{count} units',
    unitCount_one: '{count} unit',
    datePlaceholder: 'Pick a date',
    dateCalendar: 'Calendar',
    datePrevMonth: 'Previous month',
    dateNextMonth: 'Next month',
    dateToday: 'Today',
    dateClear: 'Clear',
    dateMonth: 'Month',
    dateYear: 'Year',
    datePrevYear: 'Previous year',
    dateNextYear: 'Next year',
    datePrevYears: 'Previous twelve years',
    dateNextYears: 'Next twelve years',
    monthPlaceholder: 'Pick a month',
    monthCalendar: 'Month picker',
    monthCurrent: 'This month',
    emailPlaceholder: 'name@domain.com',
    passwordPlaceholder: '••••••••',
    fullName: 'Full name',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    selectPlaceholder: 'Select…',
    listTruncated: 'Shortened list: narrow your search.',
    rowActions: 'Actions',
    listEmpty: 'No match for this search.',
    monthRange: 'Pick between {debut} and {fin}.',
    monthOnly: 'Only {debut} is available.',
    monthFrom: 'Pick from {debut} onwards.',
    monthUntil: 'Pick up to {fin}.',
    onlyDigits: 'This field only accepts digits.',
    onlyPhone: 'This field only accepts digits and the plus sign.',
    period: 'Period',
    perMonth: '/ month',
    perYear: '/ year',
    yes: 'Yes',
    no: 'No',

    // Voir `fr.ts` : pourquoi ces deux groupes ont quitté `app.`.
    crash: {
      title: 'This screen stopped',
      body:
        'An error halted the display. The rest of the app still works: try again, or go back home.',
      details: 'Technical detail',
    },

pdfConverted: 'Amounts converted from {currency} at the {date} rate: {rate}.',
    pdfConvertedPegged: 'Amounts converted from {currency} at the legal parity: {rate}.',

    chart: {
      title: 'Collections over {count} months',
      title_one: 'Collections this month',
      openMonth: 'Current month, still open.',
    },
  },

  theme: {
    auto: 'System',
    autoResolu: 'System — currently {resolu}',
    light: 'Light',
    dark: 'Dark',
  },

  status: {
    paid: 'Paid',
    partial: 'Partial',
    overdue: 'Overdue',
    vacant: 'Vacant',
    pending: 'Due soon',
    uncalled: 'Not called',
    done: 'Done',
  },

  roles: {
    owner: {
      name: 'Owner',
      short: 'You hold the estate',
      rights: 'Full read and write · settles deposits',
      pitch:
        'Consolidated portfolio view, deposit arbitration, and delegation of rights to a manager.',
    },
    manager: {
      name: 'Delegated manager',
      short: 'You run the portfolio day to day',
      rights: 'Day-to-day operations · proposes, does not decide',
      pitch:
        'Collections, meter readings, inspections, works tracking. You propose, the owner decides.',
    },
    tenant: {
      name: 'Tenant',
      short: 'You occupy a unit',
      rights: 'Their own data only',
      pitch:
        'Receipts, payment schedule, incident reporting and works tracking from your own space.',
    },
  },

  nav: {
    legalLink: 'Legal notice',
    privacyLink: 'Privacy',
    termsLink: 'Terms',
    /**
     * `\u00AD` — LE TRAIT D'UNION CONDITIONNEL, ET IL N'EST PAS DÉCORATIF.
     *
     * Invisible tant que le mot tient sur sa ligne ; il devient un trait
     * d'union à l'endroit exact où le navigateur doit couper. C'est ce que
     * `hyphens: auto` fait tout seul — QUAND le moteur a un dictionnaire pour
     * la langue. Mesuré sur ce Chromium : il en a un pour le FRANÇAIS
     * (« Signa- / lements ») et pas pour l'ANGLAIS.
     *
     * Sans lui, la barre basse retombe sur `break-words` et coupe n'importe où :
     * « Payment / s », « Dashboar / d ». La cellule fait 51 px à 320 px et
     * « Dashboard » en réclame 62 — la coupure est inévitable, seul son
     * ENDROIT se choisit. `mesure-ui` refuse désormais un orphelin de moins de
     * trois caractères, et c'est cette règle qui a nommé les deux mots.
     *
     * DEUX MOTS DE PLUS, ET C'EST UNE POLICE QUI LES A NOMMES. « Portfolio » et
     * « Reports » tenaient sur leur ligne avec la police systeme de macOS ; sous
     * une police 11 % plus large — DejaVu Sans, que met un Ubuntu derriere
     * `system-ui` — ils coupent, et sur un orphelin d'UNE lettre : « Portfoli /
     * o », « Report / s ». Le point de cesure est desormais ecrit pour eux
     * aussi. Le francais n'en a pas besoin : ce Chromium a son dictionnaire.
     *
     * LA REGLE RESTE « SEULS LES MOTS QUI CASSENT LE PORTENT », mais la liste a
     * CHANGE, et le paragraphe qui suivait ici disait le contraire du code trois
     * lignes plus bas — il nommait « Reports » (44 px) et « Portfolio » (48)
     * comme tenant dans la cellule. C'etait vrai a 44 et 48 px ; ils en font 49
     * et 53 sous une police 11 % plus large, et la cellule en offre 51. Un
     * commentaire garde apres que sa mesure a bouge est pire qu'un commentaire
     * absent : le lecteur suivant y lit une regle ET sa violation.
     *
     * Ce qui ne change pas : on n'en pose toujours PAS sur un mot qui tient. Une
     * cesure invisible que rien n'impose est une decoration que le lecteur
     * suivant croirait necessaire.
     *
     * C'est un fait de LANGUE, pas de mise en page : « Dash-board » et
     * « Pay-ments » sont les points de césure de ces mots, quelle que soit la
     * largeur qui les impose. La barre latérale porte les mêmes chaînes et n'y
     * coupe jamais — le caractère y reste invisible.
     */
    dashboard: 'Dash\u00ADboard',
    dashboardShort: 'Home',
    portfolio: 'Port\u00ADfolio',
    portfolioShort: 'Estate',
    payments: 'Pay\u00ADments',
    paymentsShort: 'Rent',
    meters: 'Meter readings',
    inspections: 'Inspections',
    works: 'Works',
    deposits: 'Deposits',
    expenses: 'Expenses',
    vacancy: 'Vacancy',
    access: 'Portfolio access',
    tenants: 'Tenants',
    report: 'Report',
    alerts: 'Re\u00ADports',
    /* LE MÊME TRAIT D'UNION CONDITIONNEL QUE SON JUMEAU LONG, deux lignes plus
       haut : `alerts` porte « Re\u00ADports » depuis son lot, `alertsShort` est
       arrivé après et ne l'a jamais reçu. À 320 px, la barre basse le coupait en
       « Report » / « s » — un fragment d'un caractère sous le reste du mot se lit
       comme une coquille, pas comme une césure. `mesure-ui` l'a nommé sur 1 824
       libellés mesurés. */
    alertsShort: 'Re\u00ADports',
    onboarding: 'Onboarding and rights',
    /* COURT, et c'est la contrainte de la barre : « Manuel d'utilisation » est
       le titre de l'écran, pas son entrée de navigation. */
    manual: 'Manual',
    system: 'System states',
    tenantPortal: 'Tenant portal (web)',
    tenantApp: 'Tenant app',
    mySpace: 'My space',
    documents: 'Documents',
    sectionMySpace: 'My space',
    sectionSteering: 'Steering',
    sectionOperations: 'Operations',
    decisions: 'Decisions',
    sectionAdmin: 'Administration',
    activeProfile: 'Active profile',
    settings: 'Settings',
    settingsOpen: 'Settings: language, currency and theme',
    settingsClose: 'Close settings',
    toggleNav: 'Collapse or expand navigation',
    openNav: 'Open navigation',
    closeNav: 'Close navigation',
    threadEmailCopies: 'Report copies',
    threadEmailDigest: 'Group them into a summary',
    myData: 'My data',
    newsletter: 'Product news by email',
    backToSite: 'Back to the website',
    backToApp: 'Back to my space',
    searchPlaceholder: 'Search a unit, a tenant…',
    searchShort: 'Unit, tenant…',
    selectPark: 'Park being viewed',
    primaryNav: 'Main navigation',
    sectionsNav: 'Product sections',
    quickNav: 'Quick navigation',
    more: 'More',
  },

  auth: {
    signIn: 'Sign in',
    signUp: 'Create account',
    signUpFree: 'Start free',
    accountMenu: 'Account of {name} — open menu',
    accountOf: 'Account of {name}',
    logout: 'Sign out',
    noAccount: 'No account yet?',
    hasAccount: 'Already have an account?',
    forgotPassword: 'Forgot your password?',

    login: {
      closureNotice:
        'Your account will be erased on {date}. Sign in again before that date to cancel the request.',
      title: 'Good to see you again',
      subtitle: 'Pick your portfolio back up.',
      submit: 'Sign in',
      remember: 'Stay signed in on this device',
      rememberHint: 'Untick on a shared computer: the session closes after twelve hours.',
      success: 'Signed in — welcome back.',
      errorCredentials: 'Incorrect email address or password.',
      errorOffline: 'The server is unreachable. Check your connection and try again.',
      errorUnexpected: 'Sign-in failed. Try again in a moment.',
    },

    forgot: {
      title: 'Reset your password',
      subtitle:
        'Enter your account email. We’ll send you a reset link valid for {minutes} minutes.',
      submit: 'Send the link',
      backToLogin: 'Back to sign in',
      sentTitle: 'Check your inbox',
      sentBody:
        'If an account exists for {email}, a reset link is on its way. Remember to check your spam folder.',
      sentDelay:
        'The link stays valid for {minutes} minutes and works only once. After that, request a new one.',
      resend: 'Send it again',
      resent: 'Request sent again',
      wrongEmail: 'Not the right address?',
    },

    reset: {
      title: 'Choose a new password',
      subtitle:
        'Every session will be closed: you will need to sign in again on each device.',
      newPassword: 'New password',
      confirm: 'Confirm the password',
      confirmHint: 'Type it again, identically.',
      submit: 'Save the password',
      successTitle: 'Password changed',
      successBody:
        'You can sign in with your new password. Every open session has been closed, including any you did not start.',
      goToLogin: 'Sign in',
      invalidTitle: 'This link is no longer valid',
      invalidBody:
        'A reset link expires after {minutes} minutes and works only once. Request a new one.',
      askAnother: 'Request a new link',
    },

    strength: {
      tooShort: 'Too short',
      fair: 'Fair',
      good: 'Good',
      strong: 'Strong',
    },

    signup: {
      title: 'Create your account',
      stepOf: 'Step {current} of {total}',
      steps: {
        role: 'Your role',
        identity: 'Your identity',
        context: 'Your context',
        review: 'Review',
      },

      roleTitle: 'Who are you?',
      roleSubtitle:
        'GestLocPro shows different things depending on your role. This choice sets your permissions, and stays changeable later.',

      identityTitle: 'Your identity',
      identitySubtitle: 'They secure your account and let us send your receipts.',

      contextTitle: 'Your context',
      contextSubtitle:
        'Your country pre-fills the currency and language of your space. You can change both.',

      reviewTitle: 'Does this all look right?',
      reviewSubtitle: 'One last check before we create your space.',

      parkName: 'Name of your portfolio',
      parkNameHint: 'Shown at the top of your space. E.g. “Bonamoussadi portfolio”.',
      unitCount: 'Units under management',
      unitCountHint: 'An estimate is enough — it guides which plan we suggest.',
      management: 'How do you run things day to day?',
      manageSolo: 'I manage on my own',
      manageSoloHint: 'Owner and manager permissions on a single account.',
      manageDelegate: 'I delegate to a manager',
      manageDelegateHint: 'You invite a manager; they propose, you decide.',

      company: 'Firm or company',
      companyHint: 'Leave empty if you operate under your own name.',
      ownerCode: 'Owner invitation code',
      ownerCodeHint:
        'The owner shares it from their space. Format: GES-XXXX-XXXX.',

      roleRequired: 'Choose the role that fits you to continue',
      inviteCode: 'Invitation code',
      inviteCodePlaceholder: 'LOC-4A7B-92CD',
      inviteCodeHint:
        'You received it by SMS or email when your lease was signed. Format: LOC-XXXX-XXXX.',
      tenantNotice:
        'A tenant does not create a space alone: it is attached to an existing lease. Without a code, ask your manager for one.',

      // Voir le bloc français : deux verbes, et c'est la règle qui les sépare.
      termsAcceptLead: 'I accept the',
      termsAcceptLink: 'terms of use',
      termsReadLead: 'and I have read the',
      termsLink: 'privacy policy',
      termsNewTab: '(opens in a new tab)',
      termsError:
        'Accept the terms of use and confirm you have read the privacy policy to create your account.',
      emailTaken: 'An account already exists for this address. Sign in, or use another one.',
      errorOffline: 'The server is unreachable. Your answers are kept: try again.',
      errorUnexpected: 'Account creation failed. Your answers are kept: try again.',
      newsletter: 'Send me product news by email, with no data resale.',

      submit: 'Create my space',
      successTitle: 'Your space is ready',
      successBody:
        'Your account is created and you are already signed in. Here is your {role} space, still empty.',
      goToDashboard: 'Open the dashboard',
      successBodyNoSession:
        'Your account is created, but the session could not be opened. Sign in with {email} to enter your {role} space.',

      editSection: 'Edit: {section}',

      summaryRole: 'Role',
      summaryName: 'Name',
      summaryEmail: 'Email',
      summaryPhone: 'Phone',
      summaryCountry: 'Country',
      summaryCurrency: 'Currency',
      summaryLanguage: 'Language',
      summaryPark: 'Portfolio',
      summaryUnits: 'Units',
      summaryManagement: 'Management',
      summaryCompany: 'Firm',
      summaryOwnerCode: 'Owner code',
      summaryInviteCode: 'Invitation code',
    },

    errors: {
      nameRequired: 'Enter your full name.',
      emailRequired: 'Enter your email address.',
      emailInvalid: 'That address doesn’t look valid. Check the format: name@domain.com',
      passwordChoose: 'Choose a password.',
      passwordEnter: 'Enter your password.',
      passwordShort: 'Use at least {n} characters.',
      phoneRequired: 'Enter a phone number.',
      phoneInvalid: 'That number looks incomplete.',
      phoneTooLong: 'That number is too long, dial code included.',
      phoneCountry: 'That number does not match the selected country’s format.',
      parkNameRequired: 'Give your portfolio a name.',
      inviteRequired: 'Enter your invitation code.',
      inviteInvalid: 'Code not recognised. Expected format: LOC-XXXX-XXXX for a tenant, GES-XXXX-XXXX for a manager.',
      countryRequired: 'Choose your country.',
      credentials: 'Incorrect email or password.',
      confirmRequired: 'Confirm your password.',
      confirmMismatch: 'The two entries do not match.',
      summaryTitle: 'Fix {count} items before continuing',
      summaryTitle_one: 'Fix {count} item before continuing',
    },
  },

  listing: {
    title: 'Home to let',
    titleFor: '{unit} · {district} — to let',
    heading: '{type} to let · {district}',
    whereLine: '{building}, unit {unit}',
    rent: 'Monthly rent',
    deposit: 'Deposit',
    surface: 'Floor area',
    surfaceValue: '{n} m²',
    availableFrom: 'Available from',
    howToApply:
      'To arrange a viewing or apply, reply to the person who sent you this link. This page does not take applications.',
    goneTitle: 'This listing is no longer available',
    goneBody:
      'It may have been withdrawn, or the home re-let. Ask the person who sent you this link for an up-to-date one.',
    failedTitle: 'The listing could not be loaded',
    failedBody: 'This is not a re-let home: the service did not respond. Try again in a moment.',
  },
  notFound: {
    code: 'Error 404',
    title: 'This page does not exist',
    body: 'The address you asked for matches no page in GestLocPro. It may have been mistyped, or the link that brought you here is out of date.',
    attempted: 'Address requested',
    home: 'Back to home',
    demo: 'Open the demonstration',
    signIn: 'Sign in',
    appTitle: 'Screen not found',
    appBody:
      'This address matches no screen in the management space. The available screens are listed in the sidebar.',
    appAction: 'Back to the dashboard',
  },

  marketing: {
    nav: {
      features: 'Features',
      roles: 'Who it’s for',
      pricing: 'Pricing',
      faq: 'Questions',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      openSettings: 'Open settings',
      closeSettings: 'Close settings',
    },

    hero: {
      eyebrow: 'Multi-country rental management',
      title: 'Your rental portfolio, held like an estate.',
      subtitle:
        'Rent, water, electricity, reminders, inspections and deposits in a single ledger. Your tenants follow their own situation; you keep the decisions.',
      ctaPrimary: 'Create my space',
      ctaSecondary: 'See the dashboard',
      trust: 'No card required · 30-day trial · Cancel anytime',
    },

    metrics: {
      title: 'What the ledger keeps current',
      collected: 'Collected this month',
      occupancy: 'Occupancy rate',
      percent: '{value}%',
      occupancyNote: '{occupied} / {total}',
      overdue: 'Still to collect',
      overdueNote: '{count} tenants',
      overdueNote_one: '{count} tenant',
      reminders: 'Reminders sent',
      note: 'Demonstration figures, sample portfolio of 12 units.',
    },

    value: {
      eyebrow: 'The problem',
      title: 'One notebook, two spreadsheets and a chat thread.',
      body:
        'That is how most private rental portfolios are run. Water readings go missing, reminders arrive too late, and nobody can find the move-in inspection three years on.',
      before: {
        one: 'Meter readings written on paper, then copied out again.',
        two: 'Arrears discovered at the end of the quarter.',
        three: 'The move-out inspection argued from memory.',
        four: 'Manager and owner working from two different versions.',
      },
    },

    features: {
      eyebrow: 'Features',
      title: 'What the product does',
      subtitle: 'Six areas of rental management, handled end to end.',
      rent: {
        title: 'Rent tracking',
        body: 'Schedule per lease, partial payments, a receipt generated on every settlement.',
      },
      utilities: {
        title: 'Water and electricity',
        body: 'Meter index per unit, consumption calculated, re-billed pro rata on the receipt.',
      },
      reminders: {
        title: 'Automatic reminders',
        body: 'Email triggered at D+1, D+7, D+15. You set the tone, the product keeps the calendar. Automatic from the Pro plan up.',
      },
      inspections: {
        title: 'Inspections',
        body: 'Move-in and move-out compared room by room, issues recorded and timestamped, costed against the deposit.',
      },
      works: {
        title: 'Works and reports',
        body: 'The tenant reports, the manager quotes, the owner decides. Every step is traced.',
      },
      deposits: {
        title: 'Deposits',
        body: 'Amount held, deductions justified, balance returned. The history stays visible to both sides.',
      },
    },

    roles: {
      eyebrow: 'Three roles',
      title: 'Everyone sees what concerns them',
      subtitle:
        'One ledger, three readings. The manager proposes, the owner decides, the tenant consults.',
      seeMore: 'What this role can do',
    },

    how: {
      eyebrow: 'Getting started',
      title: 'Three steps, then the ledger keeps itself',
      subtitle:
        'The initial entry is the only part that costs you time. What follows is day-to-day work, and the product keeps the record of it.',
      park: {
        title: 'Describe the portfolio',
        body: 'Buildings, units, active leases, meter readings on the day you take over. One entry, once.',
      },
      invite: {
        title: 'Invite the people in it',
        body: 'The tenant gets a code tied to their unit; the manager gets the rights you choose to hand over.',
      },
      run: {
        title: 'Collect, chase, arbitrate',
        body: 'A receipt on every settlement, a reminder on the due date, a compared inspection on move-out, a deposit settled item by item.',
      },
    },

    proof: {
      eyebrow: 'What we commit to',
      title: 'Four commitments, none of them asterisked',
      trial: {
        title: 'Thirty days, no card',
        body: 'The trial asks for no payment method and does not renew itself.',
      },
      commission: {
        title: 'No commission on rent',
        body: 'You pay for the subscription and the units you manage. What goes through the ledger is none of our business.',
      },
      exportable: {
        title: 'Your data leaves when you want it to',
        body: 'CSV and PDF export of the whole ledger, receipts and inspections included. No forced retention period.',
      },
      rights: {
        title: 'Rights are separated, not shared',
        body: 'The manager operates, the owner arbitrates, the tenant consults. Nobody sees somebody else’s portfolio.',
      },
    },

    international: {
      eyebrow: 'International',
      title: 'Built for more than one market',
      body:
        '{currencies} currencies, {locales} interface languages, local dial codes and date formats. The CFA franc covers both zones, from Douala to Dakar, with each country’s dial codes and conventions.',
      currencies: 'Supported currencies',
      languages: 'Interface languages',
      countries: 'Countries offered at signup',
      andMore: 'and {count} more',
      andMore_one: 'and {count} more',
    },


    pricing: {
      eyebrow: 'Pricing',
      title: 'One price per unit under management',
      subtitle:
        'No commission on rent, ever. You pay the subscription and the units you manage.',
      monthly: 'Monthly',
      yearly: 'Yearly',
      yearlySave: '−20%',
      popular: 'Most chosen',
      quote: 'On request',
      trial: '30-day trial, no card required',
      cta: 'Get started',
      unitsSelector: 'How many units do you manage?',
      unitsValue: '{count} units',
      unitsValue_one: '{count} unit',
      unitsValueMax: '{count} units and up',
      unitsValueMax_one: '{count} unit and up',
      unitsHint: 'Drag to see the price for your portfolio.',
      perUnitNote: '{base} + {perUnit} per unit',
      roundingNote: 'Rounded: the formula gives {exact}.',
      currencyNote:
        'Prices anchored locally per currency, with no automatic exchange-rate conversion.',
      vatNote: 'VAT not applicable, article 293 B of the French General Tax Code.',
      essential: { name: 'Essential', pitch: 'A first building, kept properly.' },
      pro: { name: 'Pro', pitch: 'An established portfolio, with delegation.' },
      cabinet: { name: 'Firm', pitch: 'Several owners, several companies.' },
      allIncluded:
        'Included in every plan: rent and receipt tracking, water and electricity readings, compared inspections, tenant portal.',
      features: {
        units: 'Units',
        rent: 'Rent tracking and receipts',
        meters: 'Water and electricity readings',
        portal: 'Tenant portal',
        reminders: 'Reminders',
        remindersManual: 'Manual',
        remindersAuto: 'Automatic',
        managers: 'Delegated managers',
        inspections: 'Compared inspections',
        exports: 'Accounting export',
        multiCompany: 'Multi-company',
        support: 'Support',
        supportEmail: 'By email',
        supportPriority: 'Priority',
        supportDedicated: 'Dedicated',
        managersUnlimited: 'unlimited',
      },
    },

    faq: {
      eyebrow: 'Questions',
      title: 'What people ask us',
      one: {
        q: 'Does GestLocPro convert currencies?',
        a: 'No, deliberately. Each portfolio keeps its books in its own currency. The selector changes the display format, not the value: no exchange rate is applied to your amounts.',
      },
      two: {
        q: 'Do my tenants need to create an account?',
        a: 'They receive an invitation code when the lease is signed. That code attaches them to their unit — nobody can declare themselves a tenant of one of your units.',
      },
      three: {
        q: 'Can I give my manager access without handing over everything?',
        a: 'Yes. The manager runs day-to-day operations — collections, readings, works — while deposit arbitration and global editing stay with the owner.',
      },
      four: {
        q: 'What happens if I leave?',
        a: 'You export all of your data as CSV and PDF, receipts and inspections included. No forced retention period.',
      },
      five: {
        q: 'Is there anything to install?',
        a: 'No. GestLocPro runs in a browser, on desktop as well as on a phone. Your tenants reach their space through a link received when the lease is signed, with nothing to install.',
      },
    },

    finalCta: {
      title: 'Take your portfolio back in hand',
      subtitle: 'Create your space in two minutes. No card required.',
      cta: 'Create my space',
      secondary: 'Browse the demo',
    },

    footer: {
      product: 'Product',
      demo: 'Demo',
      rights: '© {year} GestLocPro.',
    },
  },
}
