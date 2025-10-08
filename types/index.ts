// Supplier types
export interface Supplier {
  id: string;
  email: string;
  companyName: string;
  phone: string;
  status: "active" | "pending" | "blocked";
  cafe24SupplierNo?: string;
  createdAt: string;
  updatedAt?: string;
}

// Product types
export interface Product {
  id: string;
  supplierId: string;
  cafe24ProductNo?: string;
  name: string;
  price?: number; // 기존 price (하위 호환)
  sellingPrice?: number; // 판매가
  supplyPrice?: number; // 공급가
  status: "draft" | "pending" | "active" | "rejected";
  stockQty?: number;
  categoryNo?: number;
  categoryIds?: string[];
  images: {
    cover: string;
    gallery: string[];
  };
  description?: string;
  brand?: string;
  model?: string;
  createdAt: string;
  updatedAt?: string;
}

// Cafe24 OAuth types
export interface Cafe24Install {
  mallId: string;
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  installedAt: string;
  expiresAt: string;
}

// Category types
export interface Category {
  id: string;
  name: string;
  parentId?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  companyName: string;
  phone: string;
}

export interface AuthResponse {
  token: string;
  supplier: Supplier;
}
