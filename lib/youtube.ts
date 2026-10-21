const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PATH_PREFIXES = ["shorts", "live", "embed", "v"];

export type YouTubeVideo = { id: string; url: string };

export function parseYouTubeUrl(raw: string): YouTubeVideo | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || (url.port && url.port !== "443" && url.port !== "80")) return null;
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  let id: string | null = null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (host.endsWith("youtu.be")) {
    id = parts[0] ?? null;
  } else if (parts[0] === "watch") {
    id = url.searchParams.get("v");
  } else if (PATH_PREFIXES.includes(parts[0] ?? "")) {
    id = parts[1] ?? null;
  }
  if (!id || !VIDEO_ID.test(id)) return null;
  return { id, url: `https://www.youtube.com/watch?v=${id}` };
}

const OTHER_VIDEO_HOSTS = ["vimeo.com", "dailymotion.com", "tiktok.com", "twitch.tv", "kwai.com", "instagram.com", "facebook.com", "fb.watch", "loom.com", "drive.google.com"];
const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|3gp|mpe?g)$/i;

export function isUnsupportedVideoUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.toLowerCase();
    return OTHER_VIDEO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) || VIDEO_EXTENSIONS.test(url.pathname);
  } catch {
    return false;
  }
}

export const VIDEO_MAX_MINUTES = 60;
