/** プロフィール用に正方形寄りで圧縮した JPEG Blob を返す */
export async function compressAvatarFile(
  file: File,
  opts?: { maxEdge?: number; quality?: number },
): Promise<File> {
  const maxEdge = opts?.maxEdge ?? 512;
  const quality = opts?.quality ?? 0.85;

  const bitmap = await createImageBitmap(file).catch(async () => {
    // createImageBitmap がダメな場合（一部 HEIC 等）は HTMLImageElement にフォールバック
    const url = URL.createObjectURL(file);
    try {
      const img = await loadHtmlImage(url);
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像の変換に失敗しました");
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("画像の圧縮に失敗しました"))),
        "image/jpeg",
        quality,
      );
    });

    return new File([blob], `${stripExt(file.name) || "avatar"}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

function stripExt(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          "この形式の画像は開けませんでした。JPEG / PNG でお試しください",
        ),
      );
    img.src = src;
  });
}
