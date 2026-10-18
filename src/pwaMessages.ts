export type PwaRequest = 'STATUS' | 'REPAIR' | 'APPLY_UPDATE'
export type PwaReply = 'READY' | 'INCOMPLETE' | 'OTHER_WINDOWS' | 'ACTIVATING' | 'ERROR'

export function isPwaReply(value: unknown): value is PwaReply {
  return value === 'READY' || value === 'INCOMPLETE' || value === 'OTHER_WINDOWS'
    || value === 'ACTIVATING' || value === 'ERROR'
}
