import { useRef } from 'react'
import { Button, IconButton } from '@/components/primitives/Button'
import { Icon } from '@/components/primitives/Icon'
import { useT } from '@/i18n/I18nProvider'
import { PHOTOS_PAR_RESERVE } from '@/lib/transcoderPhoto'

/**
 * Une photo TENUE PAR L'ÉCRAN, avant et pendant son envoi.
 *
 * `apercu` est une URL d'objet bâtie sur `octets`, c'est-à-dire sur le blob
 * TRANSCODÉ — jamais sur le fichier d'origine. Un original de téléphone pèse
 * quelques mégaoctets ; en tenir huit pour afficher huit vignettes ferait tuer
 * l'onglet par le système sur un appareil d'entrée de gamme, et l'onglet tué
 * emporte l'état des lieux en cours de saisie, pas seulement les vignettes.
 *
 * `photoId` et `deposee` ne servent qu'à la REPRISE : ils disent où la chaîne
 * s'est arrêtée pour cette photo-là, afin qu'un second essai ne refasse pas ce
 * qui a déjà coûté un aller-retour — et ne paie pas deux fois le même objet.
 */
export interface PhotoLocale {
  cle: string
  octets: Blob
  apercu: string
  photoId?: string
  deposee: boolean
  confirmee: boolean
}

/**
 * LA RANGÉE DE PHOTOS D'UNE RÉSERVE.
 *
 * Elle vit dans une ligne de `InspectionModal`, donc dans une modale qui défile
 * déjà. Elle prend toute la largeur de la ligne (`w-full` dans un parent qui
 * enveloppe) plutôt que de se glisser à côté des champs : à 360 px, une
 * vignette posée en bout de rangée pousserait le bouton de retrait hors de vue.
 */
export function PhotosDeReserve({
  rang,
  photos,
  refus,
  onChoisir,
  onRetirer,
}: {
  rang: number
  photos: PhotoLocale[]
  /** Message de refus déjà traduit, affiché SOUS le champ. Jamais un toast. */
  refus: string | null
  onChoisir: (fichiers: File[]) => void
  onRetirer: (cle: string) => void
}) {
  const t = useT()
  const entree = useRef<HTMLInputElement>(null)
  const plein = photos.length >= PHOTOS_PAR_RESERVE

  return (
    <div className="w-full">
      {/*
        PAS DE TITRE DE RANGÉE, ET C'EST UNE MESURE QUI L'A DÉCIDÉ.

        La première rédaction posait « Photos de la réserve n° 1 » sur sa propre
        ligne, au-dessus du bouton. Mesuré par `modales.mjs` à 360 px : la
        modale passait de 237 à 323 px de défilement, pour un plafond de 250.
        Le titre répétait ce que le bouton dit déjà — « Ajouter une photo à la
        réserve n° 1 » — et le lecteur d'écran l'annonçait deux fois.
        Le retirer rend la ligne au bouton et au compte, côte à côte.
      */}
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {photos.map((photo, i) => (
            <li key={photo.cle} className="relative">
              <img
                src={photo.apercu}
                alt={t('app.inspections.photoAlt', { index: i + 1, rank: rang })}
                className="size-20 rounded-md border border-border object-cover"
              />
              {/*
                Le bouton de retrait est POSÉ SUR la vignette, mais garde ses
                44 px : `size-11` d'`IconButton` n'est pas réduit ici. Une cible
                rognée parce qu'elle chevauche une image reste une cible ratée,
                et c'est au doigt qu'on la manque, pas à la souris.
              */}
              <IconButton
                icon="close"
                variant="secondary"
                label={t('app.inspections.photoRemove', { index: i + 1, rank: rang })}
                className="absolute -right-1 -top-1"
                onClick={() => onRetirer(photo.cle)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/*
          L'ENTRÉE DE FICHIER EST CACHÉE, le bouton porte le nom accessible.

          `capture="environment"` demande l'appareil photo arrière quand le
          système en propose un — c'est un état des lieux, on photographie un
          mur, pas soi-même. Ce n'est qu'une PRÉFÉRENCE : sur un ordinateur, le
          sélecteur de fichiers s'ouvre comme d'habitude, et sur un téléphone
          l'utilisateur garde le choix de sa photothèque.

          `accept` liste les types que le navigateur sait ouvrir. Le HEIC n'y
          est pas, mais un iPhone le proposera quand même — d'où le refus
          explicite du transcodage, qui dit alors QUOI FAIRE.
        */}
        <input
          ref={entree}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const fichiers = Array.from(e.target.files ?? [])
            // Vidé AVANT le traitement : choisir deux fois le même fichier ne
            // déclenche pas d'événement si la valeur n'a pas changé.
            e.target.value = ''
            if (fichiers.length > 0) onChoisir(fichiers)
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          disabled={plein}
          onClick={() => entree.current?.click()}
        >
          {t('app.inspections.photoAdd', { rank: rang })}
        </Button>
        {/*
          LE COMPTE EST ÉCRIT EN PERMANENCE, pas seulement à la limite.

          `PHOTOS_PAR_RESERVE` n'est pas mesuré sur un appareil réel — c'est une
          prudence, et le module le dit. Une borne non mesurée qu'on ne
          découvre qu'en butant dedans est le pire des deux mondes : elle
          contraint sans s'annoncer. L'écrire ne la rend pas juste, il la rend
          au moins prévisible. Posé À CÔTÉ du bouton, il ne coûte pas de ligne.
        */}
        <span className="numeric text-caption text-muted">
          {t('app.inspections.photoCount', { done: photos.length, max: PHOTOS_PAR_RESERVE })}
        </span>
      </div>

      {plein && (
        <p className="mt-1.5 text-caption text-muted">{t('app.inspections.photoFull')}</p>
      )}

      {/*
        LE REFUS VA SOUS LE CHAMP, et il y reste.

        `aria-live` l'annonce à qui n'a pas les yeux dessus ; le texte, lui, ne
        s'efface pas. Un toast qui disparaît pendant que la photo est perdue
        laisse l'utilisateur devant une rangée vide sans savoir pourquoi — le
        dépôt a déjà tranché cette question deux fois.

        L'ICÔNE ACCOMPAGNE LE TEXTE : la couleur seule ne porte rien ici, elle
        ne fait que renforcer ce que la phrase dit déjà.
      */}
      {refus && (
        <p
          role="status"
          aria-live="polite"
          className="mt-1.5 flex items-start gap-1.5 text-caption text-danger"
        >
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
          <span>{refus}</span>
        </p>
      )}
    </div>
  )
}
