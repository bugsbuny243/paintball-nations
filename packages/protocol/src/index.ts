/** Paintball Nations — world protocol V1.
 * Authority: server validates commands and emits versioned snapshots/events.
 * No browser receives direct ownership, balance or event-write access.
 */
export const PROTOCOL_VERSION = 1 as const;
export const RESOURCES = ['pigment','material'] as const;
export type Resource = typeof RESOURCES[number];
export type SectorState = 'OWNED'|'CONTESTED'|'RESOLVING';
export type StructureKind = 'depot'|'paint_factory'|'defense_tower';
export interface SectorStateView {
  id: string;
  name: string;
  ownerFactionId: string;
  state: SectorState;
  version: number;
  lastProductionAt: string;
}
export interface WorldSnapshot {
  protocolVersion: typeof PROTOCOL_VERSION;
  worldId: 'paintball-nations';
  worldVersion: number;
  sectors: SectorStateView[];
  factions: {id:string;name:string}[];
  structures: {sectorId:string;kind:StructureKind;level:number}[];
}
export interface WorldEvent {
  worldVersion: number;
  eventType: 'structure.upgraded'|'sector.production';
  payload: Record<string,unknown>;
}
export interface UpgradeStructureIntent {
  operationId: string;
  sectorId: string;
  factionId: string;
  kind: StructureKind;
}
export interface WorldCommandResult {
  operationId: string;
  worldVersion: number;
  sectorId: string;
  kind: StructureKind;
  level: number;
  cost: {pigment:number;material:number};
}
export interface ProductionResult {
  sectorId: string;
  elapsedMinutes: number;
  pigmentAdded: number;
  materialAdded: number;
  worldVersion: number;
}
export class WorldError extends Error {
  constructor(public readonly code:string, public readonly status:number, message=code) {
    super(message);this.name='WorldError';
  }
}
export function isStructureKind(value: unknown): value is StructureKind {
  return value==='depot'||value==='paint_factory'||value==='defense_tower';
}
export function validateIdentifier(value: unknown, name: string): string {
  if(typeof value!=='string'|| !/^[a-zA-Z0-9:_-]{2,80}$/.test(value))
    throw new WorldError('invalid_'+name,400);
  return value;
}
export function validateUpgradeIntent(raw: unknown): UpgradeStructureIntent {
  if (!raw||typeof raw!=='object') throw new WorldError('invalid_request',400);
  const v=raw as Record<string,unknown>;
  const operationId=validateIdentifier(v.operationId,'operation_id');
  if(operationId.length<8) throw new WorldError('invalid_operation_id',400);
  const sectorId=validateIdentifier(v.sectorId,'sector_id');
  const factionId=validateIdentifier(v.factionId,'faction_id');
  if(!isStructureKind(v.kind)) throw new WorldError('invalid_structure_kind',400);
  return {operationId,sectorId,factionId,kind:v.kind};
}
