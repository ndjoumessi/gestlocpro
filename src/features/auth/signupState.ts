import type { CurrencyCode } from '@/currency/currencies'
import type { Locale } from '@/i18n/locales'
import { COUNTRIES, DEFAULT_COUNTRY, findCountry } from '@/lib/countries'

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
  requestAccess: boolean

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
  const country =
    COUNTRIES.find((c) => c.currency === currency) ?? findCountry(DEFAULT_COUNTRY)

  return {
    role,
    name: '',
    email: '',
    dial: country?.dial ?? '+237',
    phone: '',
    password: '',
    country: country?.code ?? DEFAULT_COUNTRY,
    currency,
    locale,
    parkName: '',
    unitCount: '1-10',
    delegates: 'solo',
    company: '',
    ownerCode: '',
    requestAccess: false,
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
