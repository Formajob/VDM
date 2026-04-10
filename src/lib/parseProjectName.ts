// src/lib/parseProjectName.ts

export interface ParsedProject {
  rawName: string
  seriesName: string
  season: string | null
  episodeNumber: string | null
  projectCode: string | null
  deadline: string | null
  broadcastChannel: string | null
  externalId: string | null
  isFilm: boolean
  valid: boolean
  error?: string
}

export function parseProjectName(raw: string): ParsedProject {
  const name = raw.trim()
  if (!name) return { rawName: name, seriesName: '', season: null, episodeNumber: null, projectCode: null, deadline: null, broadcastChannel: null, externalId: null, isFilm: false, valid: false, error: 'Nom vide' }

  // FILM / AUTRE : titre-0_materiel_date_chaine_ID
  const filmPattern = /^(.+?)-0_([a-z0-9]+)_(\d{4}-\d{1,2}-\d{1,2})_([a-z0-9]+)_(\d+)$/i

  // SÉRIE : titre-saison_episode-materiel_date_chaine_ID
  const seriePattern = /^(.+?)-(\d+)_([^-_]+)-([a-z0-9]+)_(\d{4}-\d{1,2}-\d{1,2})_([a-z0-9]+)_(\d+)$/i

  const filmMatch = name.match(filmPattern)
  const serieMatch = name.match(seriePattern)

  if (filmMatch) {
    const [, titre, materiel, dateStr, chaine, externalId] = filmMatch
    const [y, m, d] = dateStr.split('-')
    const deadline = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    const seriesName = titre.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    return { rawName: name, seriesName, season: null, episodeNumber: null, projectCode: materiel, deadline, broadcastChannel: chaine, externalId, isFilm: true, valid: true }
  }

  if (serieMatch) {
    const [, titre, saison, episode, materiel, dateStr, chaine, externalId] = serieMatch
    const [y, m, d] = dateStr.split('-')
    const deadline = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    const seriesName = titre.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    return { rawName: name, seriesName, season: saison, episodeNumber: episode, projectCode: materiel, deadline, broadcastChannel: chaine, externalId, isFilm: false, valid: true }
  }

  return { rawName: name, seriesName: name, season: null, episodeNumber: null, projectCode: null, deadline: null, broadcastChannel: null, externalId: null, isFilm: false, valid: false, error: 'Format non reconnu' }
}