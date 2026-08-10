import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { submissions } from "../../../db/schema";

type SubmissionPayload = {
  problemId?: string;
  code?: string;
  passed?: number;
  total?: number;
  ruleId?: string | null;
  hintLevel?: number;
};

function userKey(request: Request) {
  return request.headers.get("oai-authenticated-user-email") ?? "anonymous-demo";
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: submissions.id,
        problemId: submissions.problemId,
        passed: submissions.passed,
        total: submissions.total,
        ruleId: submissions.ruleId,
        hintLevel: submissions.hintLevel,
        createdAt: submissions.createdAt,
      })
      .from(submissions)
      .where(eq(submissions.userKey, userKey(request)))
      .orderBy(desc(submissions.createdAt))
      .limit(20);
    return Response.json({ submissions: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load history";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SubmissionPayload;
    const problemId = payload.problemId?.trim() ?? "";
    const code = payload.code ?? "";
    const passed = Number(payload.passed);
    const total = Number(payload.total);
    const hintLevel = Number(payload.hintLevel);

    if (!problemId || !code || code.length > 20_000) {
      return Response.json({ error: "Invalid problem or code" }, { status: 400 });
    }
    if (![passed, total, hintLevel].every(Number.isFinite)) {
      return Response.json({ error: "Invalid metrics" }, { status: 400 });
    }

    const db = getDb();
    const [row] = await db
      .insert(submissions)
      .values({
        userKey: userKey(request),
        problemId,
        code,
        passed,
        total,
        ruleId: payload.ruleId ?? null,
        hintLevel,
      })
      .returning({ id: submissions.id, createdAt: submissions.createdAt });
    return Response.json({ submission: row }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save submission";
    return Response.json({ error: message }, { status: 500 });
  }
}
