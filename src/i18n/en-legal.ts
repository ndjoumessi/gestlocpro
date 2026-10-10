/**
 * LA MOITIÉ JURIDIQUE DU DICTIONNAIRE ANGLAIS — jumelle de `fr-legal.ts`.
 *
 * Elle existe d'abord par CONTRAINTE DE TYPE : `en.ts` se type contre `fr.ts`,
 * et les trois sections ont quitté celui-ci. Elle gagne aussi des octets au
 * visiteur anglais de la vitrine, qui ne télécharge plus les trois pages
 * juridiques avec la page de vente.
 *
 * Elle voyage avec le même morceau que `fr-legal.ts` : la frontière paresseuse
 * des trois pages l'attend, comme l'espace applicatif attend `en-app`. Le
 * raisonnement complet — pourquoi l'anglais ne peut pas prendre le chemin
 * statique du français — est écrit dans `en-app.ts`.
 */
import type { DictionaryLegal } from './fr'

export const enLegal: DictionaryLegal = {
  legal: {
    title: 'Legal notice',
    intro:
      'The publisher of GestLocPro, as established by its registration certificate from the French National Business Register and the French business directory, and the service’s hosting provider.',
    publisher: 'Publisher',
    name: 'Name',
    tradeName: 'Trade name',
    regime: 'Tax regime',
    legalForm: 'Legal form',
    siren: 'SIREN number',
    siret: 'Head office SIRET',
    ape: 'APE code',
    vat: 'VAT',
    director: 'Publication director',
    nature: 'Type of establishment',
    activity: 'Main activity',
    address: 'Address',
    registration: 'Registration',
    contents: 'Contents',
    updatedOn: 'Entry up to date as of {date}',
    pageUpdatedOn: 'Page up to date as of {date}',
    hosting: 'Hosting',
    hostName: 'Company name',
    phone: 'Phone',
    email: 'Email',
    home: 'Back to home',
  },

  privacy: {
    title: 'Privacy policy',
    intro: 'What GestLocPro does with the personal data it receives, taken from how the service actually works.',
    updatedOn: 'Established as of {date}',
    controller: {
      title: 'Data controller',
      body: 'The publisher of GestLocPro: {name}, {form}, SIREN {siren}. For any question about your data, or to exercise your rights, write to:',
      email: 'or by email:',
    },
    roles: {
      title: 'Who decides what',
      account:
        'For your account — name, email address, phone, password, sign-ins — the publisher is the data controller.',
      rental:
        'The data a landlord or their manager enters about tenants, units, rents and inspections is processed on the landlord’s behalf: the landlord is the controller, and the publisher acts as their processor. If you are a tenant, contact your landlord first.',
    },
    data: {
      title: 'Data processed',
      account:
        'Account: name, email address, phone, country, language, password (stored hashed, never in plain text), date this policy was read, and newsletter choice.',
      sessions: 'Sign-ins: date and browser used, without the IP address.',
      rental:
        'Rental management: tenants’ names, phone numbers and email addresses; leases, rents, payments and security deposits; meter readings; inspections and their photos; repair and document requests; messages and announcements.',
      audit: 'Activity log: who did what, and when. It keeps a tenant’s name after the tenant is deleted.',
      none: 'No bank details, identity documents or health data are requested. Photos are re-encoded in the browser before upload, which strips their metadata, including location.',
    },
    purposes: {
      title: 'Why',
      service:
        'Providing the service — keeping the account and the rental records, sending password reset, repair follow-up and rent reminder emails: performance of the contract.',
      security: 'Protecting accounts — sign-ins and the activity log: legitimate interest.',
      newsletter: 'Newsletter: your consent, which you can withdraw from your account menu. None is sent at this time.',
      noTracking: 'No audience measurement tool, no advertising, no sale of data.',
    },
    recipients: {
      title: 'Recipients',
      intro: 'Members of a portfolio see its data according to their role. Outside the portfolio, three providers receive data:',
      hebergement: 'hosting of the application, the database and the photos',
      courriels: 'sending emails',
      relais: 'technical relay for the gestlocpro.vercel.app address',
      US: 'United States',
    },
    transfers: {
      title: 'Transfers outside the European Union',
      body: 'These three providers are based in the United States. Each states that it adheres to the EU–U.S. Data Privacy Framework, recognised by the European Commission’s adequacy decision of 10 July 2023.',
    },
    retention: {
      title: 'Retention',
      body: 'Data is kept for as long as the account or the portfolio exists. There is currently no automatic deletion: a sign-in session expires, but its record is kept.',
      onRequest:
        'On written request, the publisher deletes the data it controls. A tenant’s data is deleted on their landlord’s instruction.',
    },
    storage: {
      title: 'Cookies and browser storage',
      cookieLead: 'A single cookie:',
      cookieBody: 'It keeps you signed in; being strictly necessary, it requires no consent.',
      preferences: 'Your browser also keeps your preferences: theme, language, region, currency and exchange rates.',
      login:
        'If you tick “Stay signed in”, it keeps that choice and your email address, to prefill the sign-in form. The address stays there after you sign out, until you untick the box.',
      demo: 'The demonstration keeps its fictitious data in the browser.',
    },
    rights: {
      title: 'Your rights',
      body: 'You can ask for access to your data, its rectification, erasure or portability, or restriction of its processing, object to that processing, and set instructions for what happens to it after your death. Write to the publisher, by post or by email, at the addresses above.',
      complaint: 'If the answer does not satisfy you, you can refer the matter to the CNIL, the French data protection authority:',
      complaintLink: 'lodge a complaint with the CNIL',
    },
    home: 'Back to home',
  },

  // Voir le bloc français : « utilisation » et non « vente » est un relevé.
  terms: {
    title: 'Terms of use',
    intro:
      'What you agree to by using GestLocPro, and what the publisher undertakes to do. These terms describe the service as it works today.',
    updatedOn: 'Written on {date}',
    home: 'Back to home',

    purpose: {
      title: 'Purpose',
      body: 'These terms govern access to GestLocPro and its use. They apply from the moment an account is created, to everyone who uses it — landlord, manager or tenant.',
      publisher: 'The publisher, its registration and its contact details appear in the legal notice.',
    },

    service: {
      title: 'The service',
      body: 'GestLocPro is a rental-management tool used through a browser. It keeps a portfolio of homes: leases, rent calls, receipts, water and electricity readings, condition reports, work orders, and a portal through which a tenant sees what concerns them.',
      notTitle: 'What GestLocPro is not',
      notAdvice:
        'It gives no legal, tax or accounting advice. The documents it produces — receipts, statements, condition reports — are tracking tools, and whether they fit your situation remains your judgement.',
      notFunds:
        'It collects no rent and holds no funds. The payments you record in it are tracking entries; the money moves outside the service.',
      notAccounting: 'It does not replace accounts kept by a professional.',
    },

    account: {
      title: 'Your account',
      body: 'Creating an account requires that you be of age and able to enter into a contract. The information you provide must be accurate and kept up to date: it appears on the documents the service produces.',
      password: 'You are responsible for keeping your password confidential and for what is done from your account. Tell the publisher without delay if you suspect someone else has access to it.',
      invite: 'A manager or a tenant joins someone else’s portfolio through an invitation code, and the role comes from that code. No one can declare themselves the tenant of a home of their own accord.',
    },

    price: {
      title: 'Price',
      body: 'GestLocPro is provided free of charge to this day. No payment method is asked of you, and no invoice is issued.',
      future: 'Should the publisher decide to charge for the service, it will tell you beforehand and obtain your explicit acceptance. Without that acceptance, your account is neither charged nor closed: you keep the right to export all of your data before any decision.',
    },

    data: {
      title: 'Your data, and your tenants’',
      body: 'The data you enter is yours. The publisher does not use it for anything other than running the service.',
      controller: 'When you record your tenants’ information — identity, contact details, documents, photographs — you are the data controller for it. It is for you to inform them and to have a lawful basis for keeping it. The publisher then acts as a processor, on your behalf and on your instructions.',
      privacy: 'The detail of the processing, the recipients and your rights appears in the privacy policy.',
    },

    duties: {
      title: 'Your obligations',
      body: 'By using the service, you undertake to:',
      lawful:
        'use it only for lawful purposes, and with respect for the rights of the people whose data you record;',
      scope: 'make no attempt to reach portfolios or homes that have not been entrusted to you;',
      disrupt: 'not disrupt its operation, nor extract its content in bulk by automated means;',
      content: 'upload no unlawful content, and answer for what you do upload.',
    },

    availability: {
      title: 'Availability',
      body: 'The publisher takes reasonable steps to keep the service reachable, without committing to an uptime figure. Interruptions are possible: maintenance, failure, a provider’s outage, or force majeure.',
      backup: 'Backups are kept by the host. They are no substitute for exporting your data regularly, which the service allows at any time.',
    },

    liability: {
      title: 'Liability',
      body: 'The publisher answers for direct and foreseeable damage caused by its own failure. It does not answer for the consequences of information you entered wrongly, for use contrary to these terms, or for the loss of data you did not export while the service allowed you to.',
      force: 'Neither party answers for a failure caused by an event beyond its control.',
    },

    property: {
      title: 'Ownership',
      body: 'The service, its code, its name and its interface belong to the publisher. Using them grants you no right over them. Your data, for its part, remains yours: neither placing it on the service nor these terms transfer its ownership.',
    },

    closure: {
      title: 'Term, termination and erasure',
      body: 'These terms apply for as long as your account exists. You may end it at any time, without reason or notice, from your own space.',
      delay: 'Closing takes effect immediately on your access — your sessions are cut — and erasure follows {days} days later. That delay exists so that you can come back: simply signing in during that period cancels the closure.',
      scope: 'Erasure takes your account and the portfolios of which you are the sole owner, with everything in them. A portfolio you share with another owner survives: it is not yours alone.',
      warned: 'The people your closure would cut off — the portfolio’s managers and tenants — are warned of it, in their own language, and told again if you cancel it.',
      export: 'Before closing, you can export all of your data as CSV and PDF. No retention period is imposed on you.',
    },

    suspension: {
      title: 'Suspension',
      body: 'The publisher may suspend access in the event of a serious breach of these terms, in particular unlawful use or an attempt to reach data that has not been entrusted to you. Save in an emergency or under a legal obligation, suspension is preceded by notice and leaves you able to export your data.',
    },

    changes: {
      title: 'Changes to these terms',
      body: 'These terms may change along with the service. Any substantial change will be signalled to you before it applies. If it does not suit you, you can export your data and close your account.',
    },

    law: {
      title: 'Governing law and disputes',
      body: 'These terms are governed by French law.',
      amicable: 'In the event of a dispute, speak to the publisher first: its contact details appear in the legal notice. An amicable settlement remains the quickest route.',
      court: 'Failing agreement, the dispute falls to the courts having jurisdiction under the ordinary rules. If you are a consumer, you keep the right to bring the matter before the court of the place where you lived when the contract was made or where the damage occurred.',
    },
  },
}
