export type UiState =
  | 'IDLE'
  | 'VALIDATING'
  | 'SAVING'
  | 'UNIQUE_APPROVED'
  | 'DUPLICATE_INFORMATIVE'
  | 'DUPLICATE_WARNING'
  | 'ERROR';

export type CatalogFilter = 'ALL' | 'UNIQUE' | 'CONFIRMED_DUPLICATE';

export interface ErrorState {
  code: string;
  message: string;
  statusCode?: number;
}
