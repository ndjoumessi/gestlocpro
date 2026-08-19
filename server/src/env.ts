import { z } from 'zod'

/**
 * Configuration, validée au démarrage.
 *
 * Un serveur qui démarre avec une variable manquante ne tombe pas : il répond
 * normalement jusqu'à la première requête qui en a besoin, puis échoue avec une
 * erreur qui ne dit pas d'où vient le problème. Le coût est déplacé du
 * déploiement vers l'utilisateur.
 *
 * Ici, la moindre variable absente ou mal formée empêche le démarrage, avec le
 * nom du champ fautif.
 */
const SECRET_DE_DEV = 'dev-secret-a-remplacer'

/**
 * Charge `.env` s'il existe, sans dépendance.
 *
 * `process.loadEnvFile` est natif depuis Node 20.6 : `dotenv` n'apporterait
 * rien ici. L'absence du fichier n'est pas une erreur — en production les
 * variables viennent de la plateforme, et exiger un `.env` y ferait échouer un
 * démarrage parfaitement configuré.
 *
 * Les variables déjà présentes dans l'environnement l'emportent : c'est ce qui
 * permet à un test de forcer `DATABASE_URL` sans réécrire le fichier.
 */
try {
  process.loadEnvFile()
} catch {
  // Pas de `.env` : la plateforme fournit la configuration.
}

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET doit faire au moins 16 caractères'),
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /**
   * Clé d'API Resend. FACULTATIVE, et c'est le cœur de la couture.
   *
   * Absente, le serveur n'envoie rien et le dit — c'est l'état dans lequel le
   * produit a vécu depuis le début. La rendre obligatoire ferait échouer le
   * démarrage sur une machine de développement pour une fonction dont on n'a
   * pas besoin en développement, et l'habitude qu'on prendrait alors — poser
   * une fausse valeur pour démarrer — donnerait un serveur qui croit pouvoir
   * envoyer.
   */
  RESEND_API_KEY: z.string().min(1).optional(),
  /**
   * Expéditeur des courriels.
   *
   * Le défaut est le domaine bac à sable de Resend, qui n'accepte que l'adresse
   * du titulaire du compte en destinataire : de quoi éprouver le circuit, pas
   * de quoi servir un locataire. Un domaine vérifié se pose ici sans toucher au
   * code.
   */
  EMAIL_FROM: z.string().min(3).default('GestLocPro <onboarding@resend.dev>'),
})

function charger() {
  const resultat = schema.safeParse(process.env)

  if (!resultat.success) {
    const details = resultat.error.issues
      .map((issue) => `  ${issue.path.join('.')} — ${issue.message}`)
      .join('\n')
    throw new Error(`Configuration invalide :\n${details}`)
  }

  const env = resultat.data

  /**
   * Le secret de développement est refusé hors développement.
   *
   * C'est le défaut le plus banal et le plus grave : une valeur d'exemple
   * laissée en production signe les cookies de session de tout le monde avec un
   * secret public. Rien ne le signale à l'exécution — le produit fonctionne
   * parfaitement, et c'est précisément le problème.
   */
  if (env.NODE_ENV === 'production' && env.SESSION_SECRET === SECRET_DE_DEV) {
    throw new Error(
      'SESSION_SECRET vaut encore la valeur d’exemple. Tirez-en une au hasard :\n' +
        '  node -e "console.log(require(\'node:crypto\').randomBytes(32).toString(\'hex\'))"',
    )
  }

  return env
}

export const env = charger()
export type Env = typeof env
