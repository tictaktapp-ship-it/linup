export type StageState =
  | 'locked'
  | 'ready'
  | 'running'
  | 'awaiting_approval'
  | 'gate_failed'
  | 'budget_exceeded'
  | 'stopped'
  | 'complete';

export interface Project {
  id: string;
  name: string;
  lastStage: string;
  lastStageState: StageState;
  budgetUsed: number;
  budgetCap: number;
  lastSynced: string;
}