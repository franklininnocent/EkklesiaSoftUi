export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  status?: number;
  total?: number;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  from: number;
  last_page: number;
  per_page: number;
  to: number;
  total: number;
  first_page_url: string;
  last_page_url: string;
  prev_page_url: string | null;
  next_page_url: string | null;
  path: string;
  links: Array<{
    url: string | null;
    label: string;
    active: boolean;
  }>;
}

