import { v2 as cloudinary } from "cloudinary";
import { cacheLife } from "next/cache";

/**
 * Mirrors a logo into Cloudinary once (folder oauth-runway/logos), so pages don't depend on SVGL/BrandBird staying up.
 * Configured by CLOUDINARY_URL (cloudinary://key:secret@cloud). Without it, the original URL is returned unchanged.
 */
export async function mirrorLogo(url: string, publicId: string): Promise<string> {
  "use cache";
  cacheLife("max");
  if (!process.env.CLOUDINARY_URL) return url;
  try {
    const res = await Promise.race([
      cloudinary.uploader.upload(url, {
        folder: "oauth-runway/logos",
        public_id: publicId,
        overwrite: false,
        unique_filename: false,
        resource_type: "image",
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("cloudinary timeout")), 8000)),
    ]);
    return res.secure_url ?? url;
  } catch {
    return url;
  }
}
