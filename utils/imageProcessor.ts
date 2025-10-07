// 클라이언트 측 이미지 전처리
export async function resizeImage(
  file: File,
  maxWidth: number = 1600,
  maxHeight: number = 1600,
  quality: number = 0.85
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // 비율 유지하면서 리사이즈
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to create blob"));
            }
          },
          "image/jpeg",
          quality
        );
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// 이미지 회전 (EXIF 정보 기반)
export async function correctImageOrientation(file: File): Promise<File> {
  // 간단한 구현: EXIF 라이브러리 없이는 회전 정보를 읽기 어려움
  // 프로덕션에서는 'exif-js' 등의 라이브러리 사용 권장
  return file;
}

// 파일 크기 검증
export function validateImageSize(file: File, maxSizeMB: number = 5): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

// 파일 타입 검증
export function validateImageType(file: File): boolean {
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  return validTypes.includes(file.type);
}
