export type UserRole = 'admin' | 'operator';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  approvedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type NcmSource = 'original' | 'suggested' | 'manual' | 'empty';
export type FiscalLinkValue = 'Tributado' | 'Substituição Tributária' | '';
export type FiscalLinkSource = 'original' | 'auto_uf' | 'manual' | 'empty';

export interface ProductRow {
  id: string;
  rowIndex: number;
  description: string;
  category: string;
  price: string;
  ncm: string;
  ncmDescription: string;
  ncmSource: NcmSource;
  fiscalLink: FiscalLinkValue;
  fiscalLinkSource: FiscalLinkSource;
  fiscalReason: string;
  barcode: string;
  reviewed: boolean;
}

export interface BatchSummary {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  sourceType: 'csv' | 'xls' | 'pdf' | 'manual';
  uf: string;
  totalProducts: number;
  classifiedCount: number;
  stCount: number;
  tributadoCount: number;
  status: 'draft' | 'reviewed' | 'exported';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NcmEntry {
  code: string;
  digits: string;
  description: string;
}

export interface NcmTableState {
  sourceUrl: string;
  actReference: string;
  lastUpdatedAt: string;
  totalEntries: number;
  isLiveSynced: boolean;
}

export const BRAZILIAN_UFS = [
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'PR', name: 'Paraná' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' },
] as const;
