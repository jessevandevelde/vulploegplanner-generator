export type DayKey = 'maandag'
  | 'dinsdag'
  | 'woensdag'
  | 'donderdag'
  | 'vrijdag'
  | 'zaterdag'
  | 'zondag';

export interface PlanningGroup {
  code: number
  colli: number
  description: string
}

export interface PlanningPad {
  groups: PlanningGroup[]
  medewerkers: string[]
  padName: string
  startTime: string
  totalColli: number
}

export interface PlanningDraft {
  dayKey: DayKey
  dayLabel: string
  documentDate: string | null
  documentDateLabel: string
  pads: PlanningPad[]
  sourceFileName: string
}
