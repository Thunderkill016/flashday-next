export function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const isYouTube = hostname === 'youtube.com' || hostname.endsWith('.youtube.com');

    if (isYouTube) {
      if (urlObj.pathname === '/watch') return urlObj.searchParams.get('v') || null;
      const [type, videoId] = urlObj.pathname.split('/').filter(Boolean);
      if (['shorts', 'live', 'embed'].includes(type) && videoId) return videoId;
      return null;
    }

    if (hostname === 'youtu.be') return urlObj.pathname.split('/').filter(Boolean)[0] || null;

    return null;
  } catch {
    return null;
  }
}
