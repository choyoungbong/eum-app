import { NextResponse } from "next/server";

// 동행복권 공식 API에서 최근 회차 가져오기
async function fetchLatestRound(): Promise<number> {
  // 1회 당첨일: 2002-12-07, 매주 토요일 추첨
  const start = new Date("2002-12-07");
  const now = new Date();
  const diffWeeks = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks + 1;
}

async function fetchLottoResult(round: number) {
  const res = await fetch(
    `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) throw new Error("동행복권 API 실패");
  const data = await res.json();
  if (data.returnValue !== "success") throw new Error("당첨 데이터 없음");
  return {
    round: data.drwNo,
    date: data.drwNoDate,
    numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6],
    bonus: data.bnusNo,
    firstWinAmount: data.firstWinamnt,
    firstWinCount: data.firstPrzwnerCo,
  };
}

// 빈도 분석용 최근 N회 데이터 수집
async function fetchRecentRounds(latestRound: number, count: number = 50) {
  const rounds = Array.from({ length: count }, (_, i) => latestRound - i).filter((r) => r > 0);
  const results = await Promise.allSettled(rounds.map(fetchLottoResult));
  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<any>).value);
}

function analyzeFrequency(rounds: any[]) {
  const freq: Record<number, number> = {};
  for (let i = 1; i <= 45; i++) freq[i] = 0;
  for (const r of rounds) {
    for (const n of r.numbers) freq[n]++;
  }
  return freq;
}

function generateRecommendations(freq: Record<number, number>) {
  const sorted = Object.entries(freq)
    .map(([num, cnt]) => ({ num: Number(num), cnt }))
    .sort((a, b) => b.cnt - a.cnt);

  // 고빈도 기반: 상위 15개에서 6개 선택
  const highFreq = sorted.slice(0, 15).map((x) => x.num);

  // 저빈도 기반 (미출현 번호): 하위 15개에서 6개
  const lowFreq = sorted.slice(-15).map((x) => x.num);

  const pickRandom = (pool: number[], count: number): number[] => {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).sort((a, b) => a - b);
  };

  // AI 혼합 추천: 고빈도 3 + 저빈도 2 + 완전랜덤 1
  const allNums = Array.from({ length: 45 }, (_, i) => i + 1);
  const mixed = [
    ...pickRandom(highFreq, 3),
    ...pickRandom(lowFreq, 2),
    ...pickRandom(allNums, 1),
  ];
  // 중복 제거 후 6개 맞추기
  const mixedUnique = [...new Set(mixed)];
  while (mixedUnique.length < 6) {
    const n = Math.floor(Math.random() * 45) + 1;
    if (!mixedUnique.includes(n)) mixedUnique.push(n);
  }

  return {
    highFreq: pickRandom(highFreq, 6),
    lowFreq: pickRandom(lowFreq, 6),
    mixed: mixedUnique.slice(0, 6).sort((a, b) => a - b),
    random: pickRandom(allNums, 6),
  };
}

export async function GET() {
  try {
    const latestRound = await fetchLatestRound();

    // 최신 회차 결과 + 이전 회차 동시 조회
    const [latestResult, recentRounds] = await Promise.all([
      fetchLottoResult(latestRound).catch(() => null),
      fetchRecentRounds(latestRound, 50),
    ]);

    // 최신 회차 실패 시 이전 회차로 대체
    const actualResult = latestResult ?? (recentRounds[0] || null);

    const freq = analyzeFrequency(recentRounds);
    const recommendations = generateRecommendations(freq);

    // 빈도 상위/하위 10개
    const freqSorted = Object.entries(freq)
      .map(([num, cnt]) => ({ num: Number(num), cnt }))
      .sort((a, b) => b.cnt - a.cnt);

    return NextResponse.json({
      latest: actualResult,
      frequency: {
        top10: freqSorted.slice(0, 10),
        bottom10: freqSorted.slice(-10).reverse(),
        analyzedRounds: recentRounds.length,
      },
      recommendations,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: "로또 데이터 조회 실패" }, { status: 500 });
  }
}
