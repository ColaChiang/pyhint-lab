import { challenges } from "../../challenge-data";
import { analyzeCode, chooseHintLevel, getHint } from "../../demo-engine";

type AnalyzePayload = {
  problemId?: string;
  code?: string;
  attempts?: number;
  masteryByConcept?: Record<string, number>;
  previousRuleId?: string | null;
  previousErrorStreak?: number;
  requestedLevel?: number;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AnalyzePayload;
    const challenge = challenges.find((item) => item.id === payload.problemId);
    const code = payload.code ?? "";

    if (!challenge || !code || code.length > 20_000) {
      return Response.json({ error: "題目或程式碼格式不正確" }, { status: 400 });
    }

    const result = analyzeCode(challenge, code);
    const conceptMastery = result.finding
      ? Number(payload.masteryByConcept?.[result.finding.concept])
      : 60;
    const repeated = Boolean(result.finding && payload.previousRuleId === result.finding.ruleId);
    const previousErrorStreak = Math.max(0, Number(payload.previousErrorStreak) || 0);
    const errorStreak = result.finding ? (repeated ? previousErrorStreak + 1 : 1) : 0;
    const adaptiveLevel = chooseHintLevel(
      errorStreak,
    );
    const requestedLevel = Number(payload.requestedLevel);
    const level = Number.isFinite(requestedLevel)
      ? Math.min(5, Math.max(adaptiveLevel, requestedLevel))
      : adaptiveLevel;

    return Response.json({
      analysis: {
        syntaxValid: result.syntaxValid,
        structures: result.structures,
        finding: result.finding,
        passed: result.tests.filter((test) => test.passed).length,
        total: result.tests.length,
      },
      hint: {
        level: result.finding ? level : 0,
        content: result.finding ? getHint(result.finding, level) : "",
        errorStreak,
        mastery: Math.min(100, Math.max(0, Number.isFinite(conceptMastery) ? conceptMastery : 60)),
      },
    });
  } catch {
    return Response.json({ error: "目前無法完成診斷，請稍後再試" }, { status: 500 });
  }
}
