import { NextRequest, NextResponse } from "next/server";

const YAHOO_NEWS_URL = "https://query1.finance.yahoo.com/v1/finance/search";

interface YahooNewsItem {
  title: string;
  link: string;
  publisher: string;
  providerPublishTime: number;
  thumbnail?: { resolutions?: { url: string }[] };
  uuid: string;
  type: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "stock market korea";

  try {
    const res = await fetch(
      `${YAHOO_NEWS_URL}?q=${encodeURIComponent(query)}&newsCount=20&lang=en-US`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        next: { revalidate: 300 }, // 5분 캐시
      }
    );
    const data = await res.json();
    const news: YahooNewsItem[] = data.news ?? [];

    const items = news
      .filter((n) => n.type === "STORY")
      .map((n) => ({
        id:        n.uuid,
        title:     n.title,
        link:      n.link,
        publisher: n.publisher,
        thumbnail: n.thumbnail?.resolutions?.[0]?.url ?? null,
        publishedAt: new Date(n.providerPublishTime * 1000).toISOString(),
      }));

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [] });
  }
}
