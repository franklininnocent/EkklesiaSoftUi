export interface TenantSacramentSetting {
  id: number | null;
  sacrament_type_id: number;
  code: string;
  canonical_code?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  display_order?: number;
  is_active: boolean;
  updated_at?: string | null;
}

export interface TenantSacramentSettingsResponse {
  success: boolean;
  data: TenantSacramentSetting[];
  message?: string;
}

export interface TenantSacramentSettingUpdateResponse {
  success: boolean;
  data: TenantSacramentSetting;
  message?: string;
}
