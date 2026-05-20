// HEIC → JPEG 转换，三道保险：
// 方法1：libheif-js（WebAssembly，支持 HEVC，全浏览器包括 Chrome 都能用）
// 方法2：heic2any（轻量级，适合部分非 HEVC 编码的 HEIC）
// 方法3：Canvas 解码（Safari 原生支持 HEVC，fallback）
export async function convertIfHeic(file: File): Promise<File> {
  const name = file.name.toLowerCase();
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif");

  if (!isHeic) return file;

  const jpegName = file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg");

  // 方法1：libheif-js（WASM）— 主力方案，iPhone HEVC 格式靠这个
  // 动态 import 避免服务端渲染报错，WASM 只在浏览器里运行
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const libheif = (await import("libheif-js/wasm-bundle")).default as any;
    const arrayBuffer = await file.arrayBuffer();
    const data = new libheif.HeifDecoder().decode(new Uint8Array(arrayBuffer));
    if (!data?.length) throw new Error("no images");
    const img = data[0];
    const canvas = document.createElement("canvas");
    canvas.width = img.get_width();
    canvas.height = img.get_height();
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    await new Promise<void>((resolve, reject) =>
      img.display(imageData, (r: ImageData | null) =>
        r ? resolve() : reject(new Error("libheif display failed"))
      )
    );
    ctx.putImageData(imageData, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.9
      )
    );
    return new File([blob], jpegName, { type: "image/jpeg" });
  } catch { /* 方法1失败，继续尝试方法2 */ }

  // 方法2：heic2any（动态 import，用到时才加载）
  try {
    const heic2any = (await import("heic2any")).default;
    const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    const jpeg = Array.isArray(result) ? result[0] : result;
    return new File([jpeg], jpegName, { type: "image/jpeg" });
  } catch { /* 方法2失败，继续尝试方法3 */ }

  // 方法3：Canvas 解码（Safari 原生支持 HEVC HEIC）
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.9
      )
    );
    return new File([blob], jpegName, { type: "image/jpeg" });
  } catch { /* 三种方法都失败，返回原文件 */ }

  return file;
}
