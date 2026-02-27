// src/app/api/link-preview/route.ts
// GET /api/link-preview?url=https://...
// Open Graph 메타데이터 추출

import { NextRequest, NextResponse } from "next/server";
import { withCache, TTL } from "@/lib/cache";

interface OGData {
  title:       string | null;
  description: string | null;
  image:       string | null;
  siteName:    string | null;
  url:         string;
  favicon:     string | null;
}

function extractMeta(html: string, property: string): string | null {
  // og: 태그
  const ogMatch = html.match(
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i")
  ) ?? html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i")
  );
  if (ogMatch) return ogMatch[1];
  return null;
}

function extractMetaName(html: string, name: string): string | null {
  return html.match(
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")
  )?.[1] ?? null;
}

function extractTitle(html: string): string | null {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url 파라미터가 필요합니다" }, { status: 400 });

  // URL 유효성 검사
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol))
      return NextResponse.json({ error: "HTTP/HTTPS URL만 지원합니다" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "유효하지 않은 URL입니다" }, { status: 400 });
  }

  const cacheKey = `og:${url}`;
  const cached = withCache<OGData | null>(
    cacheKey,
    async () => {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "EumBot/1.0 (+https://eum.app)" },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return null;

        const html = await res.text();
        const origin = parsed.origin;

        const og: OGData = {
          title:       extractMeta(html, "og:title")       ?? extractTitle(html),
          description: extractMeta(html, "og:description") ?? extractMetaName(html, "description"),
          image:       extractMeta(html, "og:image"),
          siteName:    extractMeta(html, "og:site_name")   ?? parsed.hostname,
          url,
          favicon:     `${origin}/favicon.ico`,
        };

        // 상대 URL → 절대 URL 변환
        if (og.image && !og.image.startsWith("http")) {
          og.image = og.image.startsWith("/")
            ? `${origin}${og.image}`
            : `${origin}/${og.image}`;
        }

        return og;
      } catch {
        return null;
      }
    },
    TTL.LONG  // 1시간 캐시
  );

  const data = await cached;
  if (!data) return NextResponse.json({ error: "미리보기를 가져올 수 없습니다" }, { status: 422 });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
