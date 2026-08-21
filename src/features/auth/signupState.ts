import type { CurrencyCode } from '@/currency/currencies'
import type { Locale } from '@/i18n/locales'
import { DEFAULT_COUNTRY, findCountry } from '@/lib/countries'

export type Role = 'owner' | 'manager' | 'tenant'

export const ROLE_SLUGS: Record<Role, string> = {
  owner: 'proprietaire',
  manager: 'gestionnaire',
  tenant: 'locataire',
}

export const SLUG_TO_ROLE: Record<string, Role> = {
  proprietaire: 'owner',
  gestionnaire: 'manager',
  locataire: 'tenant',
}

export interface SignupState {
  role: Role | null

  // Étape identité — commune aux trois rôles.
  name: string
  email: string
  dial: string
  phone: string
  password: string

  // Étape contexte — commune.
  country: string
  currency: CurrencyCode
  locale: Locale

  // Étape contexte — propriétaire.
  parkName: string
  unitCount: string
  delegates: 'solo' | 'delegate'

  // Étape contexte — gestionnaire.
  company: string
  ownerCode: string

  // Étape contexte — locataire.
  inviteCode: string

  terms: boolean
  newsletter: boolean
}

/**
 * État initial de l'assistant.
 *
 * La devise et la langue viennent des providers, pas d'une constante : un
 * visiteur qui a choisi l'euro sur la landing ne doit pas retrouver le franc
 * CFA en arrivant sur le formulaire. Le pays est alors déduit de cette devise,
 * sans quoi l'en-tête et le champ « Devise » affichaient deux valeurs
 * différentes sur le même écran.
 */
export function initialSignupState(
  role: Role | null,
  locale: Locale,
  currency: CurrencyCode,
): SignupState {
  /**
   * LE PAYS N'EST PLUS DÉDUIT DE LA DEVISE AFFICHÉE.
   *
   * Il l'était : `COUNTRIES.find((c) => c.currency === currency)`, c'est-à-dire
   * le PREMIER pays de la liste portant cette devise — la France, parce qu'elle
   * est en tête de la zone euro. Personne n'avait décidé que ce serait la
   * France ; l'ordre d'un tableau l'avait décidé.
   *
   * Le prix ne se voyait pas d'ici. La devise gouverne l'AFFICHAGE, et un
   * visiteur la change pour lire la grille tarifaire dans sa monnaie ; le pays,
   * lui, est stocké sur le parc et commande la devise de tout ce qui s'y compte.
   * Regarder les tarifs en euros suffisait donc à faire naître son parc
   * français, et à relire ses loyers de Yaoundé six cent cinquante-six fois
   * trop grands. C'est arrivé sur le premier parc réel du produit.
   *
   * Vide, donc, et le champ devient requis : on demande au lieu de deviner.
   * C'est une question qu'un propriétaire sait répondre en une seconde — à la
   * différence d'un tarif du kilowattheure, où le silence est la bonne réponse.
   *
   * L'indicatif garde son défaut : il est visible, modifiable, et suit le pays
   * dès qu'on en choisit un.
   */
  const country = findCountry(DEFAULT_COUNTRY)

  return {
    role,
    name: '',
    email: '',
    dial: country?.dial ?? '+237',
    phone: '',
    password: '',
    country: '',
    currency,
    locale,
    parkName: '',
    unitCount: '1-10',
    delegates: 'solo',
    company: '',
    ownerCode: '',
    inviteCode: '',
    terms: false,
    newsletter: false,
  }
}

/**
 * Fourchettes d'unités. Elles servent à suggérer un palier tarifaire, pas à
 * facturer : demander un décompte exact à l'inscription ferait abandonner.
 */
export const UNIT_RANGES = ['1-10', '11-50', '51-200', '200+'] as const
