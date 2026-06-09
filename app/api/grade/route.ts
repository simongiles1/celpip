import { z } from "zod";
import { callGeminiWithJsonRetry } from "@/lib/gemini-api";
import { callGeminiStream } from "@/lib/gemini-server";
import {
  calculateGeminiCost,
  logGeminiUsage,
} from "@/lib/gemini-usage";
import {
  buildConceptDrillResults,
  computeConceptDrillScore,
  getAcceptableAnswerIndexes,
  getMcDrillResponseFromCheckInput,
  isConceptQuestionCorrect,
  isMultipleChoiceDrillSet,
  mapMcAiDrillFeedback,
  parseConceptCheckStreamText,
  parseConceptMcAnswers,
} from "@/lib/concept-drill-mc";
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS } from "@/lib/gemini";
import { normalizeGradingPayload } from "@/lib/normalize-grading-response";
import { buildFocusedGradingPrompt } from "@/lib/focus-prompts";
import {
  buildConceptGradingPrompt,
  buildConceptMcAnnotatePrompt,
  buildConceptMcGradingPrompt,
  buildConceptMcQuestionCheckPrompt,
  buildConceptMcQuestionHintPrompt,
  buildConceptQuestionCheckPrompt,
  buildConceptQuestionCheckStreamPrompt,
  buildGradingPrompt,
  buildReadingGradingPrompt,
} from "@/lib/prompts";
import { getReadingQuestionsForGrading } from "@/lib/repair-reading-answer-indices";
import { buildReadingResults } from "@/lib/reading-submission";
import { NextResponse } from "next/server";

const celpipReadingPartSchema = z.enum([
  "part_1",
  "part_2",
  "part_3",
  "part_4",
]);
const readingQuestionTypeSchema = z.enum([
  "main_idea",
  "detail_extraction",
  "inference",
  "paraphrase_recognition",
  "vocabulary_in_context",
  "distractor_analysis",
  "tone_attitude",
]);

const readingQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correctAnswerIndex: z.number(),
  celpipPart: celpipReadingPartSchema.optional(),
  questionType: readingQuestionTypeSchema.optional(),
  targetClbBand: z.number().int().min(6).max(12).optional(),
});

const focusHighlightSchema = z.object({
  text: z.string(),
  conceptId: z.string(),
  polarity: z.enum(["correct", "mistake"]),
  note: z.string(),
});

const focusRankSchema = z.object({
  conceptId: z.string(),
  estimatedScoreImpact: z.number().min(1).max(5),
  estimatedEffort: z.number().min(1).max(5),
  rationale: z.string(),
});

const skillTagSchema = z.object({
  conceptId: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
  category: z
    .enum(["grammar", "vocabulary", "reading_strategy", "writing_structure"])
    .optional(),
  polarity: z.enum(["strength", "weakness"]),
  evidence: z.string(),
});

const conceptDrillItemSchema = z.object({
  prompt: z.string(),
  hint: z.string().optional(),
  options: z.array(z.string()).length(4),
  correctAnswerIndex: z.number().int().min(0).max(3),
  acceptableAnswerIndexes: z
    .array(z.number().int().min(0).max(3))
    .min(1)
    .max(4)
    .optional(),
});

const requestSchema = z.object({
  focusSubTest: z.string(),
  examPrompt: z.string(),
  studentSubmission: z.union([
    z.string(),
    z.record(z.string(), z.union([z.number(), z.string()])),
  ]),
  readingQuestions: z.array(readingQuestionSchema).optional(),
  conceptLabel: z.string().optional(),
  conceptDrillItems: z.array(conceptDrillItemSchema).optional(),
  drillResponses: z.string().optional(),
  gradingFeedbackConstraints: z.string().optional(),
  conceptQuestionIndex: z.number().int().min(0).optional(),
  conceptGradingPhase: z.enum(["check", "full", "annotate"]).optional(),
  conceptQuestionStudentAnswer: z.string().optional(),
  conceptQuestionKnownIncorrect: z.boolean().optional(),
  stream: z.boolean().optional(),
  gradingMode: z.enum(["standard", "focused"]).optional(),
  focusConceptIds: z.array(z.string()).optional(),
  isInitialFocusAssessment: z.boolean().optional(),
  model: z.enum(GEMINI_MODELS).default(DEFAULT_GEMINI_MODEL),
});

const drillResultSchema = z.object({
  index: z.number(),
  isCorrect: z.boolean(),
  studentAnswer: z.string(),
  correctAnswer: z.string(),
  feedback: z.string(),
});

const responseSchema = z.object({
  estimatedBand: z.number().min(1).max(12),
  overallFeedback: z.string(),
  positives: z.array(z.string()),
  constructiveCriticism: z.array(z.string()),
  grammarCorrections: z.array(
    z.object({
      original: z.string(),
      corrected: z.string(),
      reason: z.string(),
      conceptId: z.string().optional(),
    }),
  ),
  skillTags: z.array(skillTagSchema).optional().default([]),
  focusHighlights: z.array(focusHighlightSchema).optional().default([]),
  focusRankings: z.array(focusRankSchema).optional().default([]),
  drillResults: z.array(drillResultSchema).optional(),
  readingResults: z
    .array(
      z.object({
        index: z.number(),
        feedback: z.string(),
        celpipPart: celpipReadingPartSchema.optional(),
        questionType: readingQuestionTypeSchema.optional(),
        targetClbBand: z.number().int().min(6).max(12).optional(),
      }),
    )
    .optional(),
  writingResult: z
    .object({
      isAcceptable: z.boolean(),
      feedback: z.string(),
    })
    .optional(),
});

function parseJsonResponse(text: string): unknown {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`)
    .join("\n");
}

function prepareGradingPayload(parsed: unknown): unknown {
  return normalizeGradingPayload(parsed);
}

const conceptMcGradingResponseSchema = z.object({
  estimatedBand: z.number().min(1).max(12),
  overallFeedback: z.string(),
  positives: z.array(z.string()),
  constructiveCriticism: z.array(z.string()),
  grammarCorrections: z
    .array(
      z.object({
        original: z.string(),
        corrected: z.string(),
        reason: z.string(),
        conceptId: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  skillTags: z.array(skillTagSchema).optional().default([]),
  drillResults: z
    .array(
      z.object({
        index: z.number(),
        feedback: z.string(),
        isAcceptable: z.boolean().optional(),
      }),
    )
    .optional(),
});

function validateGradingPayload(parsed: unknown) {
  return responseSchema.safeParse(prepareGradingPayload(parsed));
}

function validateConceptMcGradingPayload(parsed: unknown) {
  return conceptMcGradingResponseSchema.safeParse(prepareGradingPayload(parsed));
}

const conceptQuestionCheckResponseSchema = z.object({
  isCorrect: z.boolean(),
  hint: z.string().optional(),
  acceptableAnswerIndexes: z
    .array(z.number().int().min(0).max(3))
    .min(1)
    .max(4)
    .optional(),
});

const conceptDrillAnnotateResponseSchema = z.object({
  items: z.array(
    z.object({
      index: z.number().int().min(0),
      acceptableAnswerIndexes: z
        .array(z.number().int().min(0).max(3))
        .min(1)
        .max(4),
    }),
  ),
});

function computeReadingScore(
  answers: Record<string, number>,
  questions: z.infer<typeof readingQuestionSchema>[],
): { correct: number; total: number; band: number; summary: string } {
  let correct = 0;
  questions.forEach((q, i) => {
    if (answers[String(i)] === q.correctAnswerIndex) correct++;
  });
  const total = questions.length;
  const pct = total > 0 ? correct / total : 0;
  const band = Math.max(1, Math.min(12, Math.round(pct * 12)));
  return {
    correct,
    total,
    band,
    summary: `${correct}/${total} correct (${Math.round(pct * 100)}%)`,
  };
}

async function annotateConceptDrillItems(
  input: z.infer<typeof requestSchema>,
): Promise<NextResponse> {
  const items = input.conceptDrillItems ?? [];
  const prompt = buildConceptMcAnnotatePrompt(
    input.conceptLabel!,
    JSON.stringify(items),
  );

  const { text, usage } = await callGeminiWithJsonRetry(
    prompt,
    input.model,
    "Return strictly valid JSON matching the schema. No prose, no markdown.",
    "grade-concept-annotate",
    parseJsonResponse,
    (parsed) => conceptDrillAnnotateResponseSchema.safeParse(parsed).success,
    {
      describeValidationFailure: (parsed) => {
        const result = conceptDrillAnnotateResponseSchema.safeParse(parsed);
        return result.success ? undefined : formatZodIssues(result.error);
      },
    },
  );

  const validated = conceptDrillAnnotateResponseSchema.safeParse(
    parseJsonResponse(text),
  );
  if (!validated.success) {
    return NextResponse.json(
      { error: "Invalid annotate response from AI model" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    items: validated.data.items,
    geminiUsage: usage,
  });
}

function ndjsonStreamResponse(
  run: (
    sendLine: (payload: Record<string, unknown>) => void,
  ) => Promise<void>,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendLine = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        await run(sendLine);
        controller.close();
      } catch (error) {
        sendLine({
          type: "error",
          error: error instanceof Error ? error.message : "Check failed",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

function resolveLocalConceptQuestionCheck(
  input: z.infer<typeof requestSchema>,
  mcItem: z.infer<typeof conceptDrillItemSchema> | undefined,
  isMcQuestion: boolean,
): { isCorrect: boolean; acceptableAnswerIndexes: number[] } | null {
  if (!isMcQuestion || !mcItem) return null;

  const response = getMcDrillResponseFromCheckInput(input.studentSubmission);
  const isCorrect = isConceptQuestionCorrect(mcItem, response);
  if (isCorrect == null) return null;

  return {
    isCorrect,
    acceptableAnswerIndexes: getAcceptableAnswerIndexes(mcItem),
  };
}

async function streamPlainTextHintResponse(
  hintPrompt: string,
  model: z.infer<typeof requestSchema>["model"],
  sendLine: (payload: Record<string, unknown>) => void,
  doneResult: z.infer<typeof conceptQuestionCheckResponseSchema>,
): Promise<void> {
  let lastHint = "";

  const { usage } = await callGeminiStream(
    hintPrompt,
    model,
    (_chunk, accumulated) => {
      const trimmed = accumulated.trim();
      if (/^CORRECT/i.test(trimmed)) return;

      if (trimmed !== lastHint) {
        lastHint = trimmed;
        sendLine({ type: "hint", hint: trimmed });
      }
    },
    { json: false },
  );

  const geminiUsage = calculateGeminiCost(model, usage);
  logGeminiUsage("grade-concept-question-check", geminiUsage);
  sendLine({
    type: "done",
    result: {
      ...doneResult,
      hint: doneResult.hint ?? (lastHint || undefined),
    },
    geminiUsage,
  });
}

function streamConceptQuestionCheckResponse(
  input: z.infer<typeof requestSchema>,
  mcItem: z.infer<typeof conceptDrillItemSchema> | undefined,
  isMcQuestion: boolean,
  studentAnswer: string,
  promptText: string,
): Response {
  const localCheck = resolveLocalConceptQuestionCheck(
    input,
    mcItem,
    isMcQuestion,
  );

  if (localCheck?.isCorrect) {
    return ndjsonStreamResponse(async (sendLine) => {
      sendLine({
        type: "done",
        result: {
          isCorrect: true,
          acceptableAnswerIndexes: localCheck.acceptableAnswerIndexes,
        },
      });
    });
  }

  const hintPrompt =
    isMcQuestion && mcItem
      ? buildConceptMcQuestionHintPrompt(
          input.conceptLabel!,
          mcItem.prompt,
          mcItem.options,
          studentAnswer,
          input.gradingFeedbackConstraints,
        )
      : buildConceptQuestionCheckStreamPrompt(
          input.conceptLabel!,
          promptText,
          studentAnswer,
          input.gradingFeedbackConstraints,
        );

  return ndjsonStreamResponse(async (sendLine) => {
    if (localCheck && !localCheck.isCorrect) {
      await streamPlainTextHintResponse(hintPrompt, input.model, sendLine, {
        isCorrect: false,
        acceptableAnswerIndexes: localCheck.acceptableAnswerIndexes,
      });
      return;
    }

    let lastHint = "";

    const { text, usage } = await callGeminiStream(
      hintPrompt,
      input.model,
      (_chunk, accumulated) => {
        const trimmed = accumulated.trim();
        if (/^CORRECT/i.test(trimmed)) return;

        if (trimmed !== lastHint) {
          lastHint = trimmed;
          sendLine({ type: "hint", hint: trimmed });
        }
      },
      { json: false },
    );

    const parsed = parseConceptCheckStreamText(text);
    const geminiUsage = calculateGeminiCost(input.model, usage);
    logGeminiUsage("grade-concept-question-check", geminiUsage);
    sendLine({
      type: "done",
      result: {
        isCorrect: parsed.isCorrect,
        hint: parsed.hint ?? (lastHint || undefined),
        acceptableAnswerIndexes: mcItem
          ? getAcceptableAnswerIndexes(mcItem)
          : undefined,
      },
      geminiUsage,
    });
  });
}

async function gradeSingleConceptQuestion(
  input: z.infer<typeof requestSchema>,
): Promise<NextResponse | Response> {
  const questionIndex = input.conceptQuestionIndex!;
  const phase = input.conceptGradingPhase!;
  const studentAnswer = input.conceptQuestionStudentAnswer?.trim() ?? "";

  const mcItem =
    input.conceptDrillItems?.length === 1
      ? input.conceptDrillItems[0]
      : undefined;
  const isMcQuestion = mcItem != null && isMultipleChoiceDrillSet([mcItem]);
  const promptText = mcItem?.prompt ?? input.drillResponses?.split("\n")[0]?.replace(/^Q: /, "") ?? "";

  if (phase === "check") {
    const checkPrompt =
      isMcQuestion && mcItem
        ? buildConceptMcQuestionCheckPrompt(
            input.conceptLabel!,
            mcItem.prompt,
            mcItem.options,
            studentAnswer,
            mcItem.options[mcItem.correctAnswerIndex],
            input.gradingFeedbackConstraints,
          )
        : buildConceptQuestionCheckPrompt(
            input.conceptLabel!,
            promptText,
            studentAnswer,
            input.gradingFeedbackConstraints,
          );

    if (input.stream) {
      return streamConceptQuestionCheckResponse(
        input,
        mcItem,
        isMcQuestion,
        studentAnswer,
        promptText,
      );
    }

    const { text, usage } = await callGeminiWithJsonRetry(
      checkPrompt,
      input.model,
      "Return strictly valid JSON matching the schema. No prose, no markdown.",
      "grade-concept-question-check",
      parseJsonResponse,
      (parsed) => conceptQuestionCheckResponseSchema.safeParse(parsed).success,
      {
        describeValidationFailure: (parsed) => {
          const result = conceptQuestionCheckResponseSchema.safeParse(parsed);
          return result.success ? undefined : formatZodIssues(result.error);
        },
      },
    );
    const validated = conceptQuestionCheckResponseSchema.safeParse(
      parseJsonResponse(text),
    );
    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid check response from AI model" },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ...validated.data,
      geminiUsage: usage,
    });
  }

  let prompt: string;
  let conceptMcAnswers: Record<string, number> | undefined;

  if (isMcQuestion && mcItem) {
    conceptMcAnswers = parseConceptMcAnswers(
      input.studentSubmission,
      input.drillResponses,
    );
    const score = computeConceptDrillScore(conceptMcAnswers, [mcItem]);
    prompt = buildConceptMcGradingPrompt(
      input.conceptLabel!,
      JSON.stringify([mcItem]),
      JSON.stringify(conceptMcAnswers),
      score.summary,
      input.gradingFeedbackConstraints,
    );
  } else {
    const submission =
      typeof input.studentSubmission === "string"
        ? input.studentSubmission
        : JSON.stringify(input.studentSubmission);
    prompt = buildConceptGradingPrompt(
      input.conceptLabel!,
      input.drillResponses ?? "",
      submission,
      input.gradingFeedbackConstraints,
    );
  }

  const { text, usage } = await callGeminiWithJsonRetry(
    prompt,
    input.model,
    "Return strictly valid JSON matching the schema. No prose, no markdown.",
    "grade-concept-question-full",
    parseJsonResponse,
    (parsed) =>
      isMcQuestion
        ? validateConceptMcGradingPayload(parsed).success
        : validateGradingPayload(parsed).success,
    {
      describeValidationFailure: (parsed) => {
        const result = isMcQuestion
          ? validateConceptMcGradingPayload(parsed)
          : validateGradingPayload(parsed);
        return result.success ? undefined : formatZodIssues(result.error);
      },
    },
  );

  const parsedResponse = parseJsonResponse(text);
  const validated = isMcQuestion
    ? validateConceptMcGradingPayload(parsedResponse)
    : validateGradingPayload(parsedResponse);

  if (!validated.success) {
    return NextResponse.json(
      { error: "Invalid grading response from AI model" },
      { status: 502 },
    );
  }

  let drillResult;
  if (isMcQuestion && mcItem && conceptMcAnswers) {
    const mcResult = validated.data as z.infer<typeof conceptMcGradingResponseSchema>;
    const [built] = buildConceptDrillResults(
      conceptMcAnswers,
      [mcItem],
      mapMcAiDrillFeedback(mcResult.drillResults),
    );
    drillResult = { ...built, index: questionIndex };
  } else {
    const result = validated.data as z.infer<typeof responseSchema>;
    const built = result.drillResults?.[0];
    if (!built) {
      return NextResponse.json(
        { error: "Grading response missing drill result" },
        { status: 502 },
      );
    }
    drillResult = { ...built, index: questionIndex };
  }

  return NextResponse.json({
    drillResult,
    geminiUsage: usage,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = requestSchema.parse(body);

    if (
      input.focusSubTest === "Concept" &&
      input.conceptLabel &&
      input.conceptGradingPhase === "annotate" &&
      input.conceptDrillItems?.length
    ) {
      return annotateConceptDrillItems(input);
    }

    if (
      input.focusSubTest === "Concept" &&
      input.conceptLabel &&
      input.conceptQuestionIndex != null &&
      input.conceptGradingPhase
    ) {
      return gradeSingleConceptQuestion(input);
    }

    let prompt: string;
    let autoBand: number | undefined;
    let conceptDrillItemsForGrade:
      | z.infer<typeof conceptDrillItemSchema>[]
      | undefined;
    let conceptMcAnswers: Record<string, number> | undefined;
    let isMcConceptGrade = false;

    let readingQuestionsForGrade: z.infer<typeof readingQuestionSchema>[] | undefined;

    if (
      input.focusSubTest === "Reading" &&
      typeof input.studentSubmission === "object" &&
      input.readingQuestions?.length
    ) {
      readingQuestionsForGrade = getReadingQuestionsForGrading(
        input.readingQuestions,
        { examPrompt: input.examPrompt },
      );
      const score = computeReadingScore(
        input.studentSubmission,
        readingQuestionsForGrade,
      );
      autoBand = score.band;
      prompt = buildReadingGradingPrompt(
        input.examPrompt,
        JSON.stringify(input.studentSubmission),
        score.summary,
        readingQuestionsForGrade.length,
      );
    } else if (
      input.focusSubTest === "Concept" &&
      input.conceptLabel &&
      input.conceptDrillItems?.length &&
      isMultipleChoiceDrillSet(input.conceptDrillItems)
    ) {
      isMcConceptGrade = true;
      conceptDrillItemsForGrade = input.conceptDrillItems;
      conceptMcAnswers = parseConceptMcAnswers(
        input.studentSubmission,
        input.drillResponses,
      );
      const score = computeConceptDrillScore(
        conceptMcAnswers,
        conceptDrillItemsForGrade,
      );
      autoBand = score.band;
      prompt = buildConceptMcGradingPrompt(
        input.conceptLabel,
        JSON.stringify(conceptDrillItemsForGrade),
        JSON.stringify(conceptMcAnswers),
        score.summary,
        input.gradingFeedbackConstraints,
      );
    } else if (input.focusSubTest === "Concept" && input.conceptLabel) {
      const submission =
        typeof input.studentSubmission === "string"
          ? input.studentSubmission
          : JSON.stringify(input.studentSubmission);
      prompt = buildConceptGradingPrompt(
        input.conceptLabel,
        input.drillResponses ?? "",
        submission,
        input.gradingFeedbackConstraints,
      );
    } else if (input.gradingMode === "focused") {
      const submission =
        typeof input.studentSubmission === "string"
          ? input.studentSubmission
          : JSON.stringify(input.studentSubmission);
      prompt = buildFocusedGradingPrompt(
        input.examPrompt,
        submission,
        input.focusConceptIds ?? [],
        Boolean(input.isInitialFocusAssessment),
      );
    } else {
      const submission =
        typeof input.studentSubmission === "string"
          ? input.studentSubmission
          : JSON.stringify(input.studentSubmission);
      prompt = buildGradingPrompt(
        input.focusSubTest,
        input.examPrompt,
        submission,
      );
    }

    const validateParsed = (parsed: unknown) =>
      isMcConceptGrade
        ? validateConceptMcGradingPayload(parsed).success
        : validateGradingPayload(parsed).success;

    const { text, usage } = await callGeminiWithJsonRetry(
      prompt,
      input.model,
      "Return strictly valid JSON matching the schema. No prose, no markdown.",
      "grade",
      parseJsonResponse,
      validateParsed,
      {
        describeValidationFailure: (parsed) => {
          const result = isMcConceptGrade
            ? validateConceptMcGradingPayload(parsed)
            : validateGradingPayload(parsed);
          return result.success ? undefined : formatZodIssues(result.error);
        },
      },
    );

    const parsedResponse = parseJsonResponse(text);
    const validated = isMcConceptGrade
      ? validateConceptMcGradingPayload(parsedResponse)
      : validateGradingPayload(parsedResponse);

    if (!validated.success) {
      console.error(
        "[grade] Invalid grading response:",
        formatZodIssues(validated.error),
      );
      return NextResponse.json(
        { error: "Invalid grading response from AI model" },
        { status: 502 },
      );
    }

    if (isMcConceptGrade && conceptDrillItemsForGrade && conceptMcAnswers) {
      const mcResult = validated.data;
      const estimatedBand =
        autoBand !== undefined
          ? Math.round((mcResult.estimatedBand + autoBand) / 2)
          : mcResult.estimatedBand;

      return NextResponse.json({
        ...mcResult,
        estimatedBand,
        drillResults: buildConceptDrillResults(
          conceptMcAnswers,
          conceptDrillItemsForGrade,
          mapMcAiDrillFeedback(mcResult.drillResults),
        ),
        geminiUsage: usage,
      });
    }

    const result = validated.data as z.infer<typeof responseSchema>;
    if (autoBand !== undefined) {
      result.estimatedBand = Math.round((result.estimatedBand + autoBand) / 2);
    }

    if (
      input.focusSubTest === "Reading" &&
      typeof input.studentSubmission === "object" &&
      readingQuestionsForGrade?.length
    ) {
      const aiFeedback = result.readingResults?.map((item) => ({
        index: item.index,
        isCorrect: false,
        studentAnswer: "",
        correctAnswer: "",
        feedback: item.feedback,
        celpipPart: item.celpipPart,
        questionType: item.questionType,
        targetClbBand: item.targetClbBand,
      }));
      result.readingResults = buildReadingResults(
        input.studentSubmission,
        readingQuestionsForGrade,
        aiFeedback,
      );
    }

    return NextResponse.json({ ...result, geminiUsage: usage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Grading failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
