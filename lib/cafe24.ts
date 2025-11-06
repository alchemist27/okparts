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
  private refreshToken?: string;
  private clientId?: string;
  private clientSecret?: string;
  private onTokenRefresh?: (newAccessToken: string, newRefreshToken: string, expiresAt: string) => Promise<void>;

  constructor(
    mallId: string,
    accessToken: string,
    options?: {
      refreshToken?: string;
      clientId?: string;
      clientSecret?: string;
      onTokenRefresh?: (newAccessToken: string, newRefreshToken: string, expiresAt: string) => Promise<void>;
    }
  ) {
    this.mallId = mallId;
    this.accessToken = accessToken;
    this.refreshToken = options?.refreshToken;
    this.clientId = options?.clientId;
    this.clientSecret = options?.clientSecret;
    this.onTokenRefresh = options?.onTokenRefresh;
  }

  private getBaseUrl(): string {
    return `https://${this.mallId}.cafe24api.com/api/v2`;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    isRetry: boolean = false
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

    console.log(`[Cafe24 API] ${method} ${endpoint} 요청 시작`);
    const startTime = Date.now();

    // 타임아웃 설정 (50초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;

      console.log(`[Cafe24 API] ${method} ${endpoint} 응답: ${response.status} (${elapsed}ms)`);

      if (!response.ok) {
        const errorText = await response.text();

        console.error(`[Cafe24 API] 에러 발생 - Status: ${response.status}`);
        console.error(`[Cafe24 API] 에러 응답:`, errorText);

        // JSON 파싱 시도
        try {
          const errorJson = JSON.parse(errorText);
          console.error(`[Cafe24 API] 파싱된 에러:`, JSON.stringify(errorJson, null, 2));
        } catch (e) {
          console.error(`[Cafe24 API] JSON 파싱 실패, 원본 텍스트:`, errorText);
        }

        // 401 에러이고 아직 재시도하지 않았으며 리프레시 토큰이 있는 경우
        if (response.status === 401 && !isRetry && this.refreshToken && this.clientId && this.clientSecret) {
          console.log("[Cafe24 API] Access token expired, attempting refresh...");

          try {
            const tokenData = await this.refreshAccessToken(
              this.clientId,
              this.clientSecret,
              this.refreshToken
            );

            // 새 토큰으로 업데이트
            this.accessToken = tokenData.access_token;
            this.refreshToken = tokenData.refresh_token;

            console.log("[Cafe24 API] Token refreshed successfully");

            // 콜백 함수가 있으면 Firestore 업데이트
            if (this.onTokenRefresh) {
              await this.onTokenRefresh(
                tokenData.access_token,
                tokenData.refresh_token,
                tokenData.expires_at
              );
            }

            // 새 토큰으로 재시도
            return this.request<T>(method, endpoint, data, true);
          } catch (refreshError) {
            console.error("[Cafe24 API] Token refresh failed:", refreshError);
            throw new Error(`Token refresh failed: ${refreshError}`);
          }
        }

        throw new Error(
          `Cafe24 API Error: ${response.status} - ${errorText}`
        );
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);

      // AbortError는 타임아웃을 의미
      if (error.name === 'AbortError') {
        const elapsed = Date.now() - startTime;
        console.error(`[Cafe24 API] ${method} ${endpoint} 타임아웃 (${elapsed}ms)`);
        throw new Error(`Cafe24 API Timeout: ${method} ${endpoint} took more than 50 seconds`);
      }

      throw error;
    }
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
  async getCategories(params?: {
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const queryParams = new URLSearchParams({
      shop_no: "1",
      ...(params?.limit && { limit: params.limit.toString() }),
      ...(params?.offset && { offset: params.offset.toString() }),
    });

    return this.request("GET", `/admin/categories?${queryParams}`);
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

  async deleteProduct(productNo: string): Promise<any> {
    return this.request("DELETE", `/admin/products/${productNo}`);
  }

  // 메인 진열 영역 목록 조회
  async getMains(): Promise<any> {
    return this.request("GET", `/admin/mains`);
  }

  // 메인 진열 영역에 상품 추가
  async addProductToMain(displayGroup: number, productNos: number[]): Promise<any> {
    return this.request("POST", `/admin/mains/${displayGroup}/products`, {
      shop_no: 1,
      request: {
        product_no: productNos,
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

  // Product Images (단일 이미지)
  async updateProductImage(productNo: string, imageUrl: string): Promise<any> {
    return this.request("PUT", `/admin/products/${productNo}`, {
      request: {
        shop_no: 1,
        image_upload_type: "A", // A = Additional (외부 URL 사용)
        detail_image: imageUrl, // 상세 페이지 이미지
        additional_image: [imageUrl], // 리스트 썸네일 이미지
      },
    });
  }

  // Product Images Upload (Base64) - 하나씩 업로드하여 타임아웃 방지
  async uploadProductImages(base64Images: string[]): Promise<{ path: string }[]> {
    console.log("[Cafe24 API] 이미지 업로드 요청:", {
      imageCount: base64Images.length
    });

    const uploadedPaths: { path: string }[] = [];

    // 이미지를 하나씩 업로드 (타임아웃 방지)
    for (let i = 0; i < base64Images.length; i++) {
      console.log(`[Cafe24 API] 이미지 ${i + 1}/${base64Images.length} 업로드 중...`);

      try {
        const response = await this.request<{ images: { path: string }[] }>(
          "POST",
          "/admin/products/images",
          { requests: [{ image: base64Images[i] }] }
        );

        console.log(`[Cafe24 API] 이미지 ${i + 1} 업로드 응답 전체:`, JSON.stringify(response, null, 2));

        if (response.images && response.images[0]) {
          uploadedPaths.push(response.images[0]);
          console.log(`[Cafe24 API] 이미지 ${i + 1} 업로드 완료:`, response.images[0].path);
          console.log(`[Cafe24 API] 이미지 ${i + 1} 전체 객체:`, response.images[0]);
        } else {
          console.error(`[Cafe24 API] 이미지 ${i + 1} 응답에 이미지 없음:`, response);
        }
      } catch (uploadError: any) {
        console.error(`[Cafe24 API] 이미지 ${i + 1} 업로드 실패:`, uploadError.message);
        // 실패해도 계속 진행
      }
    }

    console.log("[Cafe24 API] 전체 이미지 업로드 완료:", {
      imageCount: uploadedPaths.length
    });

    return uploadedPaths;
  }

  // Product Images - 추가 이미지 등록 (additionalimages 엔드포인트)
  async addProductImages(productNo: string, base64Images: string[]): Promise<any[]> {
    console.log("[Cafe24 API] 추가 이미지 등록:", {
      productNo,
      imageCount: base64Images.length
    });

    // base64를 data URI로 변환
    const dataUris = base64Images.map(base64 => `data:image/jpeg;base64,${base64}`);

    console.log("[Cafe24 API] 추가 이미지 API 호출 중...");

    const response = await this.request<{ additionalimage: any }>(
      "POST",
      `/admin/products/${productNo}/additionalimages`,
      {
        shop_no: 1,
        request: {
          additional_image: dataUris,
        }
      }
    );

    console.log("[Cafe24 API] 추가 이미지 업로드 성공!");
    console.log("[Cafe24 API] 응답:", JSON.stringify(response, null, 2));

    // 응답에서 이미지 URL 추출 (big 이미지 사용)
    const uploadedImages = response.additionalimage.additional_image.map((img: any) => ({
      detail_image: img.big,
      list_image: img.medium,
      small_image: img.small,
    }));

    return uploadedImages;
  }

  // Product Images - 상품 이미지 업데이트 (PUT 엔드포인트)
  async updateProductImages(productNo: string, cafe24ImageUrls: string[]): Promise<any> {
    console.log("[Cafe24 API] 이미지 업데이트:", {
      productNo,
      imageCount: cafe24ImageUrls.length,
      firstImageUrl: cafe24ImageUrls[0]
    });

    // URL을 상대 경로로 변환 (YYYYMMDD/파일명.jpg 형식)
    const convertToRelativePath = (url: string): string => {
      const match = url.match(/\/NNEditor\/(\d{8}\/.+)$/);
      if (!match) {
        console.warn(`[Cafe24 API] 경로 변환 실패 - ${url}`);
        return url;
      }
      return match[1]; // 20251029/파일명.jpg
    };

    const relativeImagePaths = cafe24ImageUrls.map(convertToRelativePath);
    console.log("[Cafe24 API] 변환된 이미지 경로:", relativeImagePaths);

    return this.request("PUT", `/admin/products/${productNo}`, {
      request: {
        shop_no: 1,
        image_upload_type: "A",
        detail_image: relativeImagePaths[0],
        additional_image: relativeImagePaths,
      },
    });
  }

  // Suppliers
  async createSupplier(supplierData: any): Promise<any> {
    console.log("[Cafe24 API] 공급사 생성 요청:", `/admin/suppliers`);
    const requestData = {
      shop_no: 1,
      request: {
        ...supplierData,
      },
    };
    console.log("[Cafe24 API] 전송 데이터:", JSON.stringify(requestData, null, 2));
    return this.request("POST", "/admin/suppliers", requestData);
  }

  async getSuppliers(): Promise<any> {
    return this.request("GET", "/admin/suppliers");
  }

  async updateSupplier(supplierCode: string, supplierData: any): Promise<any> {
    console.log("[Cafe24 API] 공급사 수정 요청:", `/admin/suppliers/${supplierCode}`);
    const requestData = {
      shop_no: 1,
      request: {
        ...supplierData,
      },
    };
    console.log("[Cafe24 API] 수정 데이터:", JSON.stringify(requestData, null, 2));
    return this.request("PUT", `/admin/suppliers/${supplierCode}`, requestData);
  }

  // Supplier Users
  async createSupplierUser(supplierCode: string, userData: {
    user_id: string;
    user_name: string;
    password: string;
    phone: string;
  }): Promise<any> {
    console.log("[Cafe24 API] 공급사 사용자 생성 요청:", `/admin/suppliers/users`);
    return this.request("POST", `/admin/suppliers/users`, {
      request: {
        supplier_code: supplierCode,
        user_id: userData.user_id,
        user_name: [
          {
            shop_no: 1,
            user_name: userData.user_name,
          },
        ],
        password: userData.password,
        phone: userData.phone,
        permission_shop_no: [1],
      },
    });
  }

  async updateSupplierUser(userId: string, userData: {
    user_name?: string;
    password?: string;
    phone?: string;
  }): Promise<any> {
    console.log("[Cafe24 API] 공급사 사용자 업데이트 요청:", `/admin/suppliers/users/${userId}`);

    const requestBody: any = {
      request: {}
    };

    if (userData.user_name) {
      requestBody.request.user_name = [
        {
          shop_no: 1,
          user_name: userData.user_name,
        },
      ];
    }

    if (userData.password) {
      requestBody.request.password = userData.password;
    }

    if (userData.phone) {
      requestBody.request.phone = userData.phone;
    }

    return this.request("PUT", `/admin/suppliers/users/${userId}`, requestBody);
  }

  // SMS 발신번호 목록 조회
  async getSmsSenders(): Promise<any> {
    console.log("[Cafe24 API] SMS 발신번호 목록 조회");
    return this.request("GET", "/admin/sms/senders");
  }

  // SMS 발송
  async sendSMS(params: {
    sender_no: number | string; // 발신자 아이디 (카페24 관리자에서 등록한 발신자 번호 ID)
    recipients: string[]; // 수신자 전화번호 배열 (최대 100개)
    content: string; // 메시지 내용
    type?: "SMS" | "LMS"; // SMS(90byte) 또는 LMS(2000byte)
    title?: string; // 제목 (LMS일 때 사용)
  }): Promise<any> {
    console.log("[Cafe24 API] SMS 발송 요청");
    console.log(`[Cafe24 API] 수신자 수: ${params.recipients.length}명`);
    console.log(`[Cafe24 API] 메시지: ${params.content}`);

    // 수신자 100명씩 배치 처리 (카페24 제한)
    const BATCH_SIZE = 100;
    const results: any[] = [];

    for (let i = 0; i < params.recipients.length; i += BATCH_SIZE) {
      const batch = params.recipients.slice(i, i + BATCH_SIZE);

      console.log(`[Cafe24 API] 배치 ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length}명`);
      console.log(`[Cafe24 API] 수신자 번호:`, batch.join(", "));

      const requestData = {
        shop_no: 1,
        request: {
          sender_no: params.sender_no,
          content: params.content,
          recipients: batch,
          exclude_unsubscriber: "T", // 수신거부자 제외
          type: params.type || "SMS",
          ...(params.title && { title: params.title }),
        },
      };

      console.log(`[Cafe24 API] 요청 데이터:`, JSON.stringify(requestData, null, 2));

      try {
        const response = await this.request<{ sms: { queue_code: string } }>("POST", "/admin/sms", requestData);
        results.push(response);
        console.log(`[Cafe24 API] 배치 ${Math.floor(i / BATCH_SIZE) + 1} 발송 성공:`, response.sms?.queue_code);
      } catch (error: any) {
        console.error(`[Cafe24 API] 배치 ${Math.floor(i / BATCH_SIZE) + 1} 발송 실패:`, error.message);
        throw error;
      }
    }

    console.log(`[Cafe24 API] SMS 발송 완료: 총 ${results.length}개 배치`);
    return results;
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
    "mall.read_notification",
    "mall.write_notification",
    "mall.read_collection",
    "mall.read_promotion",
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
