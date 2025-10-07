const CAFE24_API_VERSION = "2025-09-01";

export interface Cafe24TokenResponse {
  access_token: string;
  expires_at: string;
  refresh_token: string;
  refresh_token_expires_at: string;
  client_id: string;
  mall_id: string;
  user_id: string;
  scopes: string[];
  issued_at: string;
}

export class Cafe24ApiClient {
  private mallId: string;
  private accessToken: string;

  constructor(mallId: string, accessToken: string) {
    this.mallId = mallId;
    this.accessToken = accessToken;
  }

  private getBaseUrl(): string {
    return `https://${this.mallId}.cafe24api.com/api/v2`;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      "X-Cafe24-Api-Version": CAFE24_API_VERSION,
    };

    const options: RequestInit = {
      method,
      headers,
      ...(data && { body: JSON.stringify(data) }),
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Cafe24 API Error: ${response.status} - ${errorText}`
      );
    }

    return response.json();
  }

  // Token refresh
  async refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): Promise<Cafe24TokenResponse> {
    const url = `https://${this.mallId}.cafe24api.com/api/v2/oauth/token`;

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    // Basic Auth: Base64 encode of "clientId:clientSecret"
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    return response.json();
  }

  // Categories
  async getCategories(): Promise<any> {
    return this.request("GET", "/admin/categories");
  }

  // Products
  async createProduct(productData: any): Promise<any> {
    return this.request("POST", "/admin/products", {
      request: {
        shop_no: 1,
        ...productData,
      },
    });
  }

  async getProduct(productNo: string): Promise<any> {
    return this.request("GET", `/admin/products/${productNo}`);
  }

  async updateProduct(productNo: string, productData: any): Promise<any> {
    return this.request("PUT", `/admin/products/${productNo}`, {
      request: {
        shop_no: 1,
        ...productData,
      },
    });
  }

  async getProducts(params?: {
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const queryParams = new URLSearchParams({
      shop_no: "1",
      ...(params?.limit && { limit: params.limit.toString() }),
      ...(params?.offset && { offset: params.offset.toString() }),
    });

    return this.request("GET", `/admin/products?${queryParams}`);
  }

  // Suppliers
  async createSupplier(supplierData: any): Promise<any> {
    console.log("[Cafe24 API] 공급사 생성 요청:", `/admin/suppliers`);
    return this.request("POST", "/admin/suppliers", {
      request: {
        shop_no: 1,
        ...supplierData,
      },
    });
  }

  async getSuppliers(): Promise<any> {
    return this.request("GET", "/admin/suppliers");
  }

  // Supplier Users
  async createSupplierUser(supplierCode: string, userData: {
    user_id: string;
    user_name: string;
    user_password: string;
    use_admin: string;
    phone: string;
  }): Promise<any> {
    console.log("[Cafe24 API] 공급사 사용자 생성 요청:", `/admin/suppliers/${supplierCode}/users`);
    return this.request("POST", `/admin/suppliers/${supplierCode}/users`, {
      request: {
        shop_no: 1,
        ...userData,
      },
    });
  }
}

// OAuth helper functions
export function getOAuthUrl(
  mallId: string,
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const scope = [
    "mall.read_application",
    "mall.write_application",
    "mall.read_category",
    "mall.write_category",
    "mall.read_product",
    "mall.write_product",
    "mall.read_supply",
    "mall.write_supply",
  ].join(",");

  return `https://${mallId}.cafe24api.com/api/v2/oauth/authorize?response_type=code&client_id=${clientId}&state=${state}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(scope)}`;
}

export async function exchangeCodeForToken(
  mallId: string,
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<Cafe24TokenResponse> {
  const url = `https://${mallId}.cafe24api.com/api/v2/oauth/token`;

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  // Basic Auth: Base64 encode of "clientId:clientSecret"
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  console.log("[Cafe24 Debug] Token exchange URL:", url);
  console.log("[Cafe24 Debug] Request body:", params.toString());
  console.log("[Cafe24 Debug] Auth header (first 20 chars):", `Basic ${credentials}`.substring(0, 26) + "...");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    },
    body: params.toString(),
  });

  console.log("[Cafe24 Debug] Response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Cafe24 Debug] Error response:", errorText);
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("[Cafe24 Debug] Token received, mall_id:", result.mall_id);
  return result;
}
