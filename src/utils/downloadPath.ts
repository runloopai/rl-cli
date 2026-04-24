/**
 * Utilities for inferring download file extensions from content types
 * and generating default download paths for objects.
 *
 * This is the complement of adjustFileExtension() in runloop-fe's
 * object-mount-utils.ts, which strips extensions for mount paths
 * (after decompression/extraction). This module adds extensions for
 * download paths so the saved file reflects the object's content type.
 */

/** Suffixes considered "already gzip" (case-insensitive) */
const GZIP_SUFFIXES = new Set([".gz", ".gzip", ".taz", ".tgz"]);

/** Suffixes considered "already tgz" (case-insensitive) */
const TGZ_SUFFIXES = new Set([".taz", ".tgz"]);

/**
 * Check if name ends with a compound suffix like .tar.gz or .tar.gzip
 * (case-insensitive). Returns true if the last two dot-segments match.
 */
function hasCompoundTgzSuffix(name: string): boolean {
  return /\.(tar\.gz|tar\.gzip)$/i.test(name);
}

/**
 * Get the suffix of a filename (the part after the last dot).
 * Returns empty string if no dot or only a leading dot (e.g. ".hidden").
 */
function getSuffix(name: string): string {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return "";
  return name.slice(lastDot);
}

/**
 * Returns true if the name has any dot-separated extension.
 * A leading dot alone (e.g. ".hidden") does not count as having a suffix.
 */
function hasSuffix(name: string): boolean {
  return getSuffix(name) !== "";
}

/**
 * Infer a download filename by appending or adjusting the file extension
 * based on the object's content_type.
 *
 * Rules (suffix comparisons are case-insensitive):
 * - text   + no suffix → .txt
 * - binary + no suffix → .bin
 * - gzip   + suffix is .tar → replace with .tgz
 * - gzip   + suffix not in {.gz,.gzip,.taz,.tgz,.tar} → append .gz
 * - tar    + suffix != .tar → append .tar
 * - tgz    + suffix not in {.tar.gz,.tar.gzip,.taz,.tgz} → append .tgz
 * - unspecified / undefined → no change
 */
export function inferDownloadExtension(
  name: string,
  contentType: string | undefined,
): string {
  if (!contentType || contentType === "unspecified") return name;

  const suffix = getSuffix(name).toLowerCase();

  switch (contentType) {
    case "text":
      return hasSuffix(name) ? name : `${name}.txt`;

    case "binary":
      return hasSuffix(name) ? name : `${name}.bin`;

    case "gzip":
      if (suffix === ".tar") {
        // gzipped tar → .tgz
        return name.slice(0, -suffix.length) + ".tgz";
      }
      if (GZIP_SUFFIXES.has(suffix)) return name;
      return `${name}.gz`;

    case "tar":
      if (suffix === ".tar") return name;
      return `${name}.tar`;

    case "tgz":
      if (hasCompoundTgzSuffix(name)) return name;
      if (TGZ_SUFFIXES.has(suffix)) return name;
      return `${name}.tgz`;

    default:
      return name;
  }
}

/**
 * Generate a default download path for an object.
 *
 * Uses the object's name (or ID as fallback), applies extension inference,
 * and prepends "./" for a relative path.
 */
export function getDefaultDownloadPath(
  name: string | undefined,
  id: string,
  contentType: string | undefined,
): string {
  const baseName = name?.trim() || id;
  const withExtension = inferDownloadExtension(baseName, contentType);
  return `./${withExtension}`;
}
