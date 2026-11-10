export type FindingSeverity = "high" | "medium" | "low";

export type ContentFinding = {
  id: string;
  title: string;
  explanation: string;
  severity: FindingSeverity;
  excerpt: string;
  recommendation: string;
  category:
    | "unsupported-claim"
    | "absolute-language"
    | "placeholder"
    | "outdated-reference"
    | "readability"
    | "missing-context";
};

export type ContentCheckInput = {
  content: string;
  approvedFacts?: string[];
  approvedClaims?: string[];
  requiredTerms?: string[];
  prohibitedTerms?: string[];
  sourceProvided?: boolean;
};

export type ContentCheckResult = {
  score: number;
  status: "needs-review" | "review-carefully" | "looks-consistent";
  wordCount: number;
  findings: ContentFinding[];
  summary: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function excerptAround(text: string, index: number, length: number) {
  const start = Math.max(0, index - 55);
  const end = Math.min(text.length, index + length + 55);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
}

export function checkContent(input: ContentCheckInput): ContentCheckResult {
  const content = input.content ?? "";
  const findings: ContentFinding[] = [];
  const approvedText = [
    ...(input.approvedFacts ?? []),
    ...(input.approvedClaims ?? []),
  ].join(" ").toLowerCase();

  let sequence = 0;

  function add(
    category: ContentFinding["category"],
    title: string,
    explanation: string,
    severity: FindingSeverity,
    excerpt: string,
    recommendation: string,
    position: number
  ) {
    findings.push({
      id: `${category}-${sequence++}-${position}`,
      category,
      title,
      explanation,
      severity,
      excerpt,
      recommendation,
    });
  }

  function scan(
    pattern: RegExp,
    callback: (phrase: string, position: number) => void
  ) {
    for (const match of content.matchAll(pattern)) {
      callback(match[0], match.index ?? 0);
    }
  }

  if (!content.trim()) {
    add(
      "missing-context",
      "No content to review",
      "Add the draft you want to check.",
      "high",
      "",
      "Paste the complete draft, including its headline and call to action.",
      0
    );
  } else {
    const absolutePatterns = [
      /\b100%\s*(?:guaranteed|safe|effective|success)\b/gi,
      /\b(always|never|everyone|no one|the only|number one|best in the world)\b/gi,
      /\b(guaranteed results?|zero risk|risk-free)\b/gi,
    ];

    for (const pattern of absolutePatterns) {
      scan(pattern, (phrase, position) => {
        add(
          "absolute-language",
          "Absolute or guaranteed language",
          "This wording makes a broad promise that may need evidence or qualification.",
          "high",
          excerptAround(content, position, phrase.length),
          "Verify the statement and replace absolute wording with a specific, supportable claim.",
          position
        );
      });
    }

    const promotionalPatterns = [
      /\bclinically proven\b/gi,
      /\bscientifically proven\b/gi,
      /\baward[- ]winning\b/gi,
      /\bindustry[- ]leading\b/gi,
      /\btrusted by (?:millions|thousands|everyone)\b/gi,
      /\bworld[- ]class\b/gi,
      /\bdoctor[- ]recommended\b/gi,
      /\bcertified\s+(?:best|number one|#1)\b/gi,
      /(?:^|\s)#1\b/gm,
    ];

    for (const pattern of promotionalPatterns) {
      scan(pattern, (phrase, position) => {
        if (approvedText.includes(phrase.toLowerCase().trim())) return;
        add(
          "unsupported-claim",
          "Promotional claim needs evidence",
          `The phrase "${phrase.trim()}" makes a credibility, performance or recognition claim that was not matched to approved Company Brain wording.`,
          "high",
          excerptAround(content, position, phrase.length),
          "Attach verifiable evidence and obtain approval for this claim, or rewrite it as a factual statement.",
          position
        );
      });
    }

    const placeholderPatterns = [
      /\[(?:insert|add|write|company|brand|date|name|link|source)[^\]]*\]/gi,
      /\b(lorem ipsum|your company here|coming soon|tbd|todo)\b/gi,
    ];

    for (const pattern of placeholderPatterns) {
      scan(pattern, (phrase, position) => {
        add(
          "placeholder",
          "Unresolved placeholder",
          "The draft appears to contain temporary text.",
          "medium",
          excerptAround(content, position, phrase.length),
          "Replace the placeholder with approved final content or remove it.",
          position
        );
      });
    }

    const currentYear = new Date().getFullYear();
    scan(/\b20\d{2}\b|\b(last year|this year|next year)\b/gi, (phrase, position) => {
      const year = Number(phrase);
      if (phrase.toLowerCase() === "this year" || year === currentYear) return;

      add(
        "outdated-reference",
        "Date reference needs verification",
        "This year or date reference may be outdated or time-sensitive.",
        "medium",
        excerptAround(content, position, phrase.length),
        "Confirm the date is still correct or replace it with an approved current reference.",
        position
      );
    });

    if (!input.sourceProvided) {
      const numericPattern =
        /(?:₹\s?\d[\d,]*(?:\.\d+)?|\b\d+(?:\.\d+)?\s?(?:%|percent|lakh|lakhs|crore|crores|million|billion|users|customers|days|hours|times|x)\b)/gi;

      scan(numericPattern, (phrase, position) => {
        const normalized = phrase.toLowerCase().replace(/\s+/g, " ").trim();
        if (!normalized || approvedText.includes(normalized)) return;

        add(
          "unsupported-claim",
          "Promotional number needs verification",
          "A price, percentage, statistic or quantified result was found but was not matched against the approved facts and claims supplied to this check.",
          "high",
          excerptAround(content, position, phrase.length),
          "Verify the number against an approved fact or claim and attach its source.",
          position
        );
      });
    }

    for (const term of input.prohibitedTerms ?? []) {
      const clean = term.trim();
      if (!clean) continue;

      const pattern = new RegExp(escapeRegExp(clean), "gi");
      scan(pattern, (phrase, position) => {
        add(
          "missing-context",
          "Prohibited brand terminology",
          `The term "${clean}" is marked as prohibited in the approved brand rules.`,
          "high",
          excerptAround(content, position, phrase.length),
          "Remove this term or replace it with approved brand wording.",
          position
        );
      });
    }

    for (const term of input.requiredTerms ?? []) {
      const clean = term.trim();
      if (!clean) continue;

      const pattern = new RegExp(escapeRegExp(clean), "i");
      if (!pattern.test(content)) {
        add(
          "missing-context",
          "Required brand term is missing",
          `The required term "${clean}" was not found in this draft.`,
          "low",
          "",
          `Check whether "${clean}" should be included in this content.`,
          0
        );
      }
    }

    const sentences = content
      .split(/[.!?]+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    for (const sentence of sentences) {
      const words = sentence.split(/\s+/).filter(Boolean);
      if (words.length > 35) {
        const position = content.indexOf(sentence);
        add(
          "readability",
          "Long sentence",
          "This sentence is longer than 35 words and may be difficult to scan.",
          "low",
          excerptAround(content, position, sentence.length),
          "Consider splitting it into shorter, clearer sentences.",
          position
        );
      }
    }
  }

  const uniqueFindings = findings.filter(
    (finding, position, all) =>
      all.findIndex(
        (item) =>
          item.category === finding.category &&
          item.excerpt.toLowerCase() === finding.excerpt.toLowerCase() &&
          item.title === finding.title
      ) === position
  );

  const high = uniqueFindings.filter((item) => item.severity === "high").length;
  const medium = uniqueFindings.filter((item) => item.severity === "medium").length;
  const low = uniqueFindings.filter((item) => item.severity === "low").length;

  const score = Math.max(0, Math.min(100, 100 - high * 18 - medium * 9 - low * 3));
  const status =
    high > 0 || score < 65
      ? "needs-review"
      : medium > 0 || score < 90
        ? "review-carefully"
        : "looks-consistent";

  const wordCount = content.trim()
    ? content.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const summary =
    uniqueFindings.length === 0
      ? "No obvious issues were detected in this first-pass review. Human approval is still required."
      : `${uniqueFindings.length} potential issue${uniqueFindings.length === 1 ? "" : "s"} found: ${high} high, ${medium} medium and ${low} low priority. Review the findings before publication.`;

  return { score, status, wordCount, findings: uniqueFindings, summary };
}
