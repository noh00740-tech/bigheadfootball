import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { players } = await req.json();

    if (!players || !Array.isArray(players) || players.length !== 4) {
      return NextResponse.json(
        { error: "정확히 4명의 포지션별 선수가 필요합니다." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "서버에 GEMINI_API_KEY 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // 선수 정보 포맷팅
    const playerDetails = players
      .map(
        (p) =>
          `- [${p.position}] 이름: ${p.name}, 국가: ${p.nation}, 스탯(속도: ${p.stat_speed}, 슈팅: ${p.stat_shoot}, 점프: ${p.stat_jump})`
      )
      .join("\n");

    const systemPrompt = `너는 2026 북중미 월드컵 최고의 축구 전술 분석가이자 세계적인 해설가다.
유저가 FW, MF, DF, GK 각 1명씩으로 구성한 4인 드림팀의 정보를 바탕으로 아래의 5가지 요소들을 상세히 분석해라.

분석 대상 팀 정보:
${playerDetails}

요구사항:
1. 반드시 아래의 JSON 포맷으로만 응답해라. 마크다운 Fenced block(\`\`\`json)은 포함하지 말고 순수 JSON 문자열만 반환해야 한다.
2. 각 필드는 반드시 한국어로 정중하고 생동감 있게 작성해라.
3. rating은 S, A, B, C, D 중 하나로 산정해라.

JSON 포맷 예시:
{
  "rating": "A",
  "attack": "공격진 속도와 슈팅 스탯 기반 공격 성향 분석...",
  "defense": "수비수와 골키퍼의 점프, 속도 스탯 기반 수비 안정성 분석...",
  "synergy": "선수들의 국가 조합 및 포지션 밸런스에 기반한 예상 시너지 효과 분석...",
  "summary": "최종 전술 한줄 평 및 종합 분석..."
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: systemPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API Error Response:", errText);
      return NextResponse.json(
        { error: `Gemini API 호출에 실패했습니다: ${response.statusText}` },
        { status: response.status }
      );
    }

    const resData = await response.json();
    const textResult = resData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResult) {
      return NextResponse.json(
        { error: "Gemini API로부터 응답 텍스트를 받지 못했습니다." },
        { status: 500 }
      );
    }

    // 안전하게 JSON 파싱 시도
    let parsedResult;
    try {
      parsedResult = JSON.parse(textResult.trim());
    } catch (parseError) {
      console.error("Gemini Response parsing failed. Text:", textResult);
      // 만약 마크다운 백틱 등이 딸려온 경우 대처
      const cleanJsonStr = textResult
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      parsedResult = JSON.parse(cleanJsonStr);
    }

    return NextResponse.json(parsedResult);
  } catch (error: any) {
    console.error("Analyze API Exception:", error);
    return NextResponse.json(
      { error: error.message || "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
