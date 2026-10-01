import type { SelectedRelationType } from '../types/domain';

export interface RelationOption {
  value: SelectedRelationType;
  label: string;
}

/** Exactly the relation list from the requirements / design export. */
export const RELATION_OPTIONS: RelationOption[] = [
  { value: 'PREQUEL', label: 'Prequel' },
  { value: 'SEQUEL', label: 'Sequel' },
  { value: 'SIDE_STORY', label: 'Side Story' },
  { value: 'SPIN_OFF', label: 'Spin Off' },
  { value: 'ALTERNATIVE', label: 'Alternative' },
];

export const RELATION_LABELS: Record<SelectedRelationType, string> = {
  PREQUEL: 'Prequel',
  SEQUEL: 'Sequel',
  SIDE_STORY: 'Side Story',
  SPIN_OFF: 'Spin Off',
  ALTERNATIVE: 'Alternative',
};

/** Default selection matches the design export (Prequel + Sequel checked). */
export const DEFAULT_RELATIONS: SelectedRelationType[] = ['PREQUEL', 'SEQUEL'];
