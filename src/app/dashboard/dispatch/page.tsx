'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Package, Plus, Send, Edit3, Save, X, AlertCircle, Tv, Search, 
  Upload, ClipboardPaste, FileText, Check, AlertTriangle, UserCheck,
  SortAsc, SortDesc, Calendar, Clock, Filter
} from 'lucide-react'
import { toast } from 'sonner'
import { useDemoMode, DemoUser } from '@/hooks/useDemoMode'
import { parseProjectName, ParsedProject } from '@/lib/parseProjectName'

// ─── Types ───────────────────────────────────────────────
interface Project {
  id: string
  name: string
  seriesName: string
  season: string | null
  episodeNumber: string | null
  broadcastChannel: string | null
  projectCode: string | null
  deadline: string
  startDate: string | null
  durationMin: number | null
  comment: string | null
  redacteurId?: string | null
}

interface Redacteur {
  id: string
  name: string
  email: string
  jobRole: string
}

type SortField = 'deadline' | 'startDate' | 'seriesName' | 'durationMin' | 'redacteurId'
type SortOrder = 'asc' | 'desc'

// ─── Modal Import en masse ────────────────────────────────
function ImportModal({ redacteurs, onClose, onImport }: {
  redacteurs: Redacteur[]
  onClose: () => void
  onImport: (projects: (ParsedProject & { redacteurId?: string })[]) => Promise<void>
}) {
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<(ParsedProject & { redacteurId?: string })[]>([])
  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const lines = text.split('\n').map(l => l.split(',')[0].split('\t')[0].trim()).filter(Boolean)
      setRawText(lines.join('\n'))
    }
    reader.readAsText(file)
  }

  const handleParse = () => {
    if (!rawText.trim()) { toast.error('Collez des noms de projets'); return }
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
    const results = lines.map(l => ({ ...parseProjectName(l), redacteurId: '' }))
    setParsed(results)
    setStep('preview')
  }

  const setRedacteur = (index: number, redacteurId: string) => {
    setParsed(prev => prev.map((p, i) => i === index ? { ...p, redacteurId } : p))
  }

  const setAllRedacteur = (redacteurId: string) => {
    setParsed(prev => prev.map(p => ({ ...p, redacteurId })))
  }

  const validProjects = parsed.filter(p => p.valid)

  const handleImport = async () => {
    setImporting(true)
    await onImport(parsed.filter(p => p.valid))
    setImporting(false)
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-500" />
            Import en masse
          </DialogTitle>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-4 flex-1 overflow-auto py-2">
            <p className="text-sm text-muted-foreground">
              Collez les noms de projets (un par ligne) ou importez un fichier CSV/TXT.
            </p>

            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-indigo-200 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors"
            >
              <Upload className="w-8 h-8 text-indigo-300 mx-auto mb-2" />
              <p className="text-sm text-slate-600 font-medium">Glisser un fichier CSV / TXT</p>
              <p className="text-xs text-slate-400 mt-1">ou cliquer pour parcourir</p>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="flex-1 h-px bg-slate-200" />ou coller directement<div className="flex-1 h-px bg-slate-200" />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <ClipboardPaste className="w-3.5 h-3.5 text-indigo-500" />
                Noms de projets (un par ligne)
              </Label>
              <Textarea
                placeholder={`salledecoute-film_film-m8877a_2026-4-18_tva_27302856\nlarecrue-7_7-g04330_2026-5-13_tva_30959776\n...`}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                className="resize-none h-48 text-xs font-mono"
              />
              <p className="text-xs text-slate-400">
                {rawText.split('\n').filter(l => l.trim()).length} ligne(s) détectée(s)
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto py-2 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <Check className="w-4 h-4" />{validProjects.length} valide(s)
                </span>
                {parsed.filter(p => !p.valid).length > 0 && (
                  <span className="flex items-center gap-1 text-orange-500 font-medium">
                    <AlertTriangle className="w-4 h-4" />{parsed.filter(p => !p.valid).length} erreur(s)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Tout assigner à :</span>
                <Select onValueChange={setAllRedacteur}>
                  <SelectTrigger className="w-44 h-8 text-xs">
                    <SelectValue placeholder="Choisir..." />
                  </SelectTrigger>
                  <SelectContent>
                    {redacteurs.map(r => <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Nom brut</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Titre</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Échéance</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Rédacteur</th>
                    <th className="py-2 px-3 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((p, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${!p.valid ? 'bg-red-50' : ''}`}>
                      <td className="py-2 px-3 font-mono text-slate-400 max-w-[160px] truncate">{p.rawName}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">
                        {p.valid ? (
                          <>
                            {p.seriesName}
                            {p.season && <span className="text-slate-400"> S{p.season}</span>}
                            {p.episodeNumber && <span className="text-slate-400"> Ép.{p.episodeNumber}</span>}
                            {p.isFilm && <span className="ml-1 text-purple-500 text-xs">(film)</span>}
                          </>
                        ) : (
                          <span className="text-red-500">{p.error}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {p.deadline
                          ? new Date(p.deadline).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
                          : '—'}
                      </td>
                      <td className="py-2 px-3">
                        {p.valid && (
                          <Select value={p.redacteurId || ''} onValueChange={v => setRedacteur(i, v)}>
                            <SelectTrigger className="h-7 w-36 text-xs border-slate-200">
                              <SelectValue placeholder="Assigner..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs text-slate-400">Non assigné</SelectItem>
                              {redacteurs.map(r => (
                                <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {p.valid
                          ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                          : <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          {step === 'preview' && (
            <Button variant="outline" size="sm" onClick={() => setStep('input')}>← Modifier</Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          {step === 'input' ? (
            <Button size="sm" onClick={handleParse} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
              <FileText className="w-3.5 h-3.5" />Analyser
            </Button>
          ) : (
            <Button size="sm" onClick={handleImport} disabled={importing || !validProjects.length}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              {importing ? 'Import...' : `Importer ${validProjects.length} projet(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Modal ajout manuel ───────────────────────────────────
function AddProjectModal({ redacteurs, onClose, onSave }: {
  redacteurs: Redacteur[]
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [rawName, setRawName] = useState('')
  const [parsed, setParsed] = useState<ParsedProject | null>(null)
  const [form, setForm] = useState({
    seriesName: '', season: '', episodeNumber: '',
    broadcastChannel: '', projectCode: '', deadline: '',
    startDate: '', durationMin: '', comment: '', redacteurId: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleRawNameChange = (val: string) => {
    setRawName(val)
    if (val.trim()) {
      const p = parseProjectName(val)
      setParsed(p)
      if (p.valid) {
        setForm(f => ({
          ...f,
          seriesName: p.seriesName,
          season: p.season || '',
          episodeNumber: p.episodeNumber || '',
          broadcastChannel: p.broadcastChannel || '',
          projectCode: p.projectCode || '',
          deadline: p.deadline || '',
        }))
      }
    } else {
      setParsed(null)
    }
  }

  const handleSave = async () => {
    if (!form.seriesName || !form.deadline) { toast.error('Série et échéance obligatoires'); return }
    setSaving(true)
    await onSave({ ...form, name: rawName || form.seriesName, durationMin: form.durationMin ? parseFloat(form.durationMin) : null })
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-500" />Nouveau projet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 font-semibold">
              Nom du fichier <span className="text-xs font-normal text-slate-400">(auto-remplissage)</span>
            </Label>
            <Input
              placeholder="ex: larecrue-7_7-g04330_2026-5-13_tva_30959776"
              value={rawName}
              onChange={e => handleRawNameChange(e.target.value)}
              className="font-mono text-xs"
            />
            {parsed && (
              <p className={`text-xs flex items-center gap-1 ${parsed.valid ? 'text-emerald-600' : 'text-orange-500'}`}>
                {parsed.valid
                  ? <><Check className="w-3 h-3" />Reconnu — {parsed.isFilm ? 'Film' : `Série S${parsed.season} Ép.${parsed.episodeNumber}`}</>
                  : <><AlertTriangle className="w-3 h-3" />{parsed.error}</>}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Série / Titre *</Label>
              <Input value={form.seriesName} onChange={e => set('seriesName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Saison</Label>
              <Input value={form.season} onChange={e => set('season', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Épisode</Label>
              <Input value={form.episodeNumber} onChange={e => set('episodeNumber', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Chaîne</Label>
              <Input value={form.broadcastChannel} onChange={e => set('broadcastChannel', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Durée (min)</Label>
              <Input type="number" value={form.durationMin} onChange={e => set('durationMin', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date réception</Label>
              <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Échéance *</Label>
              <Input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-500" />Assigner au rédacteur
              </Label>
              <Select value={form.redacteurId} onValueChange={v => set('redacteurId', v === 'none' ? '' : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choisir un rédacteur (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné (dispatch plus tard)</SelectItem>
                  {redacteurs.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Commentaire</Label>
              <Textarea value={form.comment} onChange={e => set('comment', e.target.value)} className="resize-none h-16 text-sm" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
            <Save className="w-3.5 h-3.5" />{saving ? 'Enregistrement...' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Modal édition ────────────────────────────────────────
function EditProjectModal({ project, redacteurs, onClose, onSave }: {
  project: Project; redacteurs: Redacteur[]; onClose: () => void; onSave: (data: any) => Promise<void>
}) {
  const [form, setForm] = useState({
    seriesName: project.seriesName || '',
    season: project.season || '',
    episodeNumber: project.episodeNumber || '',
    broadcastChannel: project.broadcastChannel || '',
    projectCode: project.projectCode || '',
    deadline: project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : '',
    startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
    durationMin: project.durationMin?.toString() || '',
    comment: project.comment || '',
    redacteurId: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    await onSave({ id: project.id, ...form, durationMin: form.durationMin ? parseFloat(form.durationMin) : null })
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-indigo-500" />Modifier le projet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5 py-1">
          <p className="text-xs font-mono text-slate-400 bg-slate-50 rounded px-2 py-1.5 break-all">{project.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2 space-y-1.5"><Label>Série / Titre</Label><Input value={form.seriesName} onChange={e => set('seriesName', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Saison</Label><Input value={form.season} onChange={e => set('season', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Épisode</Label><Input value={form.episodeNumber} onChange={e => set('episodeNumber', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Chaîne</Label><Input value={form.broadcastChannel} onChange={e => set('broadcastChannel', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Durée (min)</Label><Input type="number" value={form.durationMin} onChange={e => set('durationMin', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Date réception</Label><Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Échéance</Label><Input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} /></div>
          <div className="col-span-2 space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-500" />Assigner au rédacteur
            </Label>
            <Select value={form.redacteurId} onValueChange={v => set('redacteurId', v === 'none' ? '' : v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choisir un rédacteur..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Non assigné</SelectItem>
                {redacteurs.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5"><Label>Commentaire</Label><Textarea value={form.comment} onChange={e => set('comment', e.target.value)} className="resize-none h-16 text-sm" /></div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
            <Save className="w-3.5 h-3.5" />{saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Ligne projet avec infos mises à jour ────────────
function ProjectRow({ project, redacteurs, onEdit, onAssign }: {
  project: Project & { redacteurId?: string | null }
  redacteurs: Redacteur[]
  onEdit: () => void
  onAssign: (projectId: string, redacteurId: string) => void
}) {
  const hours = (new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60)
  const isLate = hours < 0
  const isSoon = hours < 48 && hours >= 0

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
      <td className="py-2.5 px-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-mono text-slate-400 truncate max-w-[180px]">{project.name}</span>
          <span className="font-medium text-sm text-slate-800">
            {project.seriesName}
            {project.season && <span className="text-slate-500 font-normal"> S{project.season}</span>}
            {project.episodeNumber && <span className="text-slate-500 font-normal"> Ép.{project.episodeNumber}</span>}
          </span>
        </div>
      </td>
      
      {/* ✅ Date réception */}
      <td className="py-2.5 px-3 hidden md:table-cell">
        {project.startDate ? (
          <span className="text-xs flex items-center gap-1 text-slate-600">
            <Calendar className="w-3 h-3 text-slate-400" />
            {new Date(project.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          </span>
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )}
      </td>
      
      {/* ✅ Durée */}
      <td className="py-2.5 px-3 hidden sm:table-cell text-center">
        {project.durationMin ? (
          <span className="text-sm font-semibold text-indigo-600">
            {project.durationMin}<span className="text-xs font-normal text-slate-400"> min</span>
          </span>
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )}
      </td>
      
      {/* ✅ Échéance avec alerte */}
      <td className="py-2.5 px-3">
        <span className={`text-xs font-medium flex items-center gap-1 ${isLate ? 'text-red-600' : isSoon ? 'text-orange-500' : 'text-slate-600'}`}>
          {(isLate || isSoon) && <AlertCircle className="w-3 h-3" />}
          {new Date(project.deadline).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
        </span>
      </td>
      
      {/* ✅ Rédacteur */}
      <td className="py-2 px-3">
        <Select
          value={project.redacteurId || ''}
          onValueChange={v => onAssign(project.id, v === 'none' ? '' : v)}
        >
          <SelectTrigger className="h-7 w-40 text-xs border-slate-200 hover:border-indigo-300">
            <SelectValue placeholder="Assigner..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs text-slate-400">Non assigné</SelectItem>
            {redacteurs.map(r => (
              <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      
      {/* ✅ Commentaire (truncate) */}
      <td className="py-2.5 px-3 max-w-[200px] hidden lg:table-cell">
        {project.comment ? (
          <span className="text-xs text-slate-500 truncate block" title={project.comment}>
            {project.comment}
          </span>
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )}
      </td>

      {/* ✅ Bouton édition */}
      <td className="py-2.5 px-3 text-right">
        <button onClick={onEdit} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-indigo-100 text-indigo-500 transition-all">
          <Edit3 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  )
}

// ─── Page principale ──────────────────────────────────────
export default function DispatchPage() {
  const { data: sessionData, status } = useSession()
  const { isDemo, demoUser } = useDemoMode()
  const router = useRouter()

  const [projects, setProjects] = useState<(Project & { redacteurId?: string | null })[]>([])
  const [redacteurs, setRedacteurs] = useState<Redacteur[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, string>>({})
  const [dispatching, setDispatching] = useState(false)
  
  // ✅ Filtres et tri
  const [filterRedacteur, setFilterRedacteur] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('deadline')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const user: DemoUser | null = (sessionData?.user as DemoUser) || demoUser || null
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (!isDemo && status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && !isAdmin) router.push('/dashboard')
  }, [status, isAdmin])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/projects/dispatch')
      const data = await res.json()
      setProjects(data.projects || [])
      setRedacteurs(data.redacteurs || [])
    } catch { toast.error('Erreur de chargement') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (user) fetchData() }, [user, fetchData])

  const handleAssign = (projectId: string, redacteurId: string) => {
    setPendingAssignments(prev => ({ ...prev, [projectId]: redacteurId }))
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, redacteurId } : p))
  }

  const handleDispatchAll = async () => {
    const toDispatch = Object.entries(pendingAssignments).filter(([, rid]) => rid)
    if (!toDispatch.length) { toast.error('Aucune assignation à envoyer'); return }
    setDispatching(true)
    try {
      await Promise.all(
        toDispatch.map(([projectId, redacteurId]) =>
          fetch('/api/projects/dispatch', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectIds: [projectId], redacteurId }),
          })
        )
      )
      toast.success(`${toDispatch.length} projet(s) dispatché(s)`)
      setPendingAssignments({})
      fetchData()
    } catch { toast.error('Erreur lors du dispatch') }
    finally { setDispatching(false) }
  }

  const handleAddProject = async (data: any) => {
    try {
      const res = await fetch('/api/projects/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        console.error('POST error:', err)
        throw new Error(err.error)
      }
      const proj = await res.json()

      if (data.redacteurId && data.redacteurId !== 'none') {
        setPendingAssignments(prev => ({ ...prev, [proj.id]: data.redacteurId }))
        setProjects(prev => [...prev, { ...proj, redacteurId: data.redacteurId }])
      } else {
        setProjects(prev => [...prev, proj])
      }

      toast.success('Projet ajouté à la bannette')
      fetchData()
    } catch (e: any) {
      toast.error(`Erreur: ${e.message}`)
    }
  }

  const handleImportProjects = async (parsedProjects: (ParsedProject & { redacteurId?: string })[]) => {
    try {
      const res = await fetch('/api/projects/dispatch/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: parsedProjects }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(`${data.count} projet(s) importé(s)`)
      fetchData()
    } catch { toast.error("Erreur lors de l'import") }
  }

  const handleEditProject = async (data: any) => {
    try {
      const res = await fetch('/api/projects/dispatch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      if (data.redacteurId) {
        await fetch('/api/projects/dispatch', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectIds: [data.id], redacteurId: data.redacteurId }),
        })
      }
      toast.success('Projet modifié')
      fetchData()
    } catch { toast.error('Erreur lors de la modification') }
  }

  // ✅ FILTRER et TRIER les projets
  const filtered = projects
    .filter(p => {
      if (!search) return true
      const q = search.toLowerCase()
      return p.name?.toLowerCase().includes(q) ||
        p.seriesName.toLowerCase().includes(q) ||
        p.comment?.toLowerCase().includes(q)
    })
    .filter(p => {
      if (filterRedacteur === 'all') return true
      if (filterRedacteur === 'unassigned') return !p.redacteurId
      return p.redacteurId === filterRedacteur
    })
    .sort((a, b) => {
      let aVal: any, bVal: any
      switch (sortField) {
        case 'deadline': aVal = a.deadline; bVal = b.deadline; break
        case 'startDate': aVal = a.startDate || ''; bVal = b.startDate || ''; break
        case 'seriesName': aVal = a.seriesName; bVal = b.seriesName; break
        case 'durationMin': aVal = a.durationMin || 0; bVal = b.durationMin || 0; break
        case 'redacteurId': aVal = a.redacteurId || ''; bVal = b.redacteurId || ''; break
        default: return 0
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

  // ✅ CALCULER TOTAUX
  const totalProjects = filtered.length
  const totalMinutes = filtered.reduce((sum, p) => sum + (p.durationMin || 0), 0)
  const pendingCount = Object.values(pendingAssignments).filter(v => v).length

  if (loading) return (
    <DashboardLayout>
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="h-6 w-6 text-indigo-600" />Dispatch
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gérez les projets en attente d'assignation
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowImport(true)} variant="outline" size="sm" className="gap-2 border-indigo-200">
              <Upload className="w-4 h-4" />Import masse
            </Button>
            <Button onClick={() => setShowAdd(true)} size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="w-4 h-4" />Ajouter
            </Button>
          </div>
        </div>

        {/* ✅ Stats Totaux */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Total projets</p>
                <p className="text-2xl font-bold text-indigo-600">{totalProjects}</p>
              </div>
              <Package className="w-8 h-8 text-indigo-200" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Durée totale</p>
                <p className="text-2xl font-bold text-emerald-600">{totalMinutes} min</p>
              </div>
              <Clock className="w-8 h-8 text-emerald-200" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">À dispatcher</p>
                <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              </div>
              <UserCheck className="w-8 h-8 text-amber-200" />
            </div>
          </div>
        </div>

        {/* Barre dispatch en attente */}
        {pendingCount > 0 && (
          <div className="bg-indigo-600 text-white rounded-xl p-4 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              <span className="font-medium">{pendingCount} assignation(s) en attente</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleDispatchAll} disabled={dispatching}
                className="bg-white text-indigo-700 hover:bg-indigo-50 gap-1.5 font-semibold">
                <Send className="w-3.5 h-3.5" />{dispatching ? 'Envoi...' : 'Confirmer le dispatch'}
              </Button>
              <button onClick={() => { setPendingAssignments({}); fetchData() }} className="p-1.5 rounded hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ✅ Recherche + Filtres + Tri */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Rechercher (nom, série, commentaire...)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          
          {/* Filtre rédacteur */}
          <Select value={filterRedacteur} onValueChange={setFilterRedacteur}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder="Filtrer par rédacteur" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="unassigned">Non assignés</SelectItem>
              {redacteurs.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Tri */}
          <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deadline">Échéance</SelectItem>
              <SelectItem value="startDate">Date réception</SelectItem>
              <SelectItem value="seriesName">Nom série</SelectItem>
              <SelectItem value="durationMin">Durée</SelectItem>
              <SelectItem value="redacteurId">Rédacteur</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Ordre */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="w-10 h-9 p-0"
          >
            {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Aucun projet trouvé</p>
              <p className="text-slate-400 text-sm mt-1">Utilisez "Import masse" ou "Ajouter" pour créer des projets</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Projet</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 hidden md:table-cell">Date réception</th>
                    <th className="text-center py-2.5 px-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Durée</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Échéance</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">Rédacteur</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500 hidden lg:table-cell">Commentaire</th>
                    <th className="py-2.5 px-3 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <ProjectRow
                      key={p.id}
                      project={p}
                      redacteurs={redacteurs}
                      onEdit={() => setEditingProject(p)}
                      onAssign={handleAssign}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modals */}
        {showAdd && <AddProjectModal redacteurs={redacteurs} onClose={() => setShowAdd(false)} onSave={handleAddProject} />}
        {showImport && <ImportModal redacteurs={redacteurs} onClose={() => setShowImport(false)} onImport={handleImportProjects} />}
        {editingProject && <EditProjectModal project={editingProject} redacteurs={redacteurs} onClose={() => setEditingProject(null)} onSave={handleEditProject} />}
      </div>
    </DashboardLayout>
  )
}