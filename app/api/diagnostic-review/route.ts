import { NextResponse } from "next/server";

type DiagnosticPayload = {
  name?: string;
  email?: string;
  company?: string;
  caseType?: string;
  urgency?: string;
  sensitive?: string;
  website?: string;
  summary?: string;
  chargebackType?: string;
  paymentProvider?: string;
  orderId?: string;
  orderDate?: string;
  amount?: string;
  customerEmail?: string;
  chargebackReason?: string;
  evidenceNotes?: string;
};

type EvidenceFile = {
  filename: string;
  contentType: string;
  size: number;
  content: string;
};

const MAX_FILES = 8;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 4000) : "";
}

async function parseRequest(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const files = formData
      .getAll("evidenceFiles")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    return {
      body: {
        name: clean(formData.get("name")),
        email: clean(formData.get("email")),
        company: clean(formData.get("company")),
        caseType: clean(formData.get("caseType")),
        urgency: clean(formData.get("urgency")),
        sensitive: clean(formData.get("sensitive")),
        website: clean(formData.get("website")),
        summary: clean(formData.get("summary")),
        chargebackType: clean(formData.get("chargebackType")),
        paymentProvider: clean(formData.get("paymentProvider")),
        orderId: clean(formData.get("orderId")),
        orderDate: clean(formData.get("orderDate")),
        amount: clean(formData.get("amount")),
        customerEmail: clean(formData.get("customerEmail")),
        chargebackReason: clean(formData.get("chargebackReason")),
        evidenceNotes: clean(formData.get("evidenceNotes")),
      },
      files,
    };
  }

  const json = (await request.json()) as DiagnosticPayload;
  return { body: json, files: [] as File[] };
}

async function prepareEvidenceFiles(files: File[]) {
  if (files.length > MAX_FILES) {
    return { error: `Too many files. Max ${MAX_FILES}.`, attachments: [] as EvidenceFile[] };
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_TOTAL_BYTES) {
    return { error: "Files are too large. Max total size is 8MB.", attachments: [] as EvidenceFile[] };
  }

  const attachments: EvidenceFile[] = [];

  for (const file of files) {
    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      return { error: `Unsupported file type: ${file.type || file.name}`, attachments: [] as EvidenceFile[] };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    attachments.push({
      filename: file.name || "evidence-file",
      contentType: file.type || "application/octet-stream",
      size: file.size,
      content: buffer.toString("base64"),
    });
  }

  return { attachments };
}

export async function POST(request: Request) {
  let parsed: { body: DiagnosticPayload; files: File[] };

  try {
    parsed = await parseRequest(request);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { body, files } = parsed;
  const preparedFiles = await prepareEvidenceFiles(files);

  if (preparedFiles.error) {
    return NextResponse.json({ error: preparedFiles.error }, { status: 400 });
  }

  const payload = {
    name: clean(body.name),
    email: clean(body.email),
    company: clean(body.company),
    caseType: clean(body.caseType),
    urgency: clean(body.urgency),
    sensitive: clean(body.sensitive),
    website: clean(body.website),
    summary: clean(body.summary),
    chargebackType: clean(body.chargebackType),
    paymentProvider: clean(body.paymentProvider),
    orderId: clean(body.orderId),
    orderDate: clean(body.orderDate),
    amount: clean(body.amount),
    customerEmail: clean(body.customerEmail),
    chargebackReason: clean(body.chargebackReason),
    evidenceNotes: clean(body.evidenceNotes),
  };

  if (!payload.name || !payload.email || !payload.caseType || !payload.urgency || !payload.sensitive || !payload.summary) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!isValidEmail(payload.email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const requestId = `GBC-${Date.now().toString(36).toUpperCase()}`;
  const submittedAt = new Date().toISOString();

  const message = [
    `Request ID: ${requestId}`,
    `Submitted At: ${submittedAt}`,
    "",
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Company: ${payload.company || "-"}`,
    `Case Type: ${payload.caseType}`,
    `Urgency: ${payload.urgency}`,
    `Sensitive Materials: ${payload.sensitive}`,
    `Website: ${payload.website || "-"}`,
    "",
    "Case Summary:",
    payload.summary,
    "",
    "Chargeback Evidence Intake:",
    `Chargeback Type: ${payload.chargebackType || "-"}`,
    `Payment Provider: ${payload.paymentProvider || "-"}`,
    `Order / Transaction ID: ${payload.orderId || "-"}`,
    `Order Date: ${payload.orderDate || "-"}`,
    `Transaction Amount: ${payload.amount || "-"}`,
    `Customer Email: ${payload.customerEmail || "-"}`,
    `Reason Code / Dispute Reason: ${payload.chargebackReason || "-"}`,
    `Evidence Files: ${
      preparedFiles.attachments.length
        ? preparedFiles.attachments.map((file) => `${file.filename} (${Math.round(file.size / 1024)}KB)`).join(", ")
        : "-"
    }`,
    "",
    "Evidence Notes:",
    payload.evidenceNotes || "-",
  ].join("\n");

  const resendApiKey = process.env.RESEND_API_KEY;
  const leadTo = process.env.LEAD_NOTIFICATION_EMAIL;
  const leadFrom = process.env.LEAD_FROM_EMAIL || "Global Bridge Compliance <onboarding@resend.dev>";

  if (resendApiKey && leadTo) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: leadFrom,
        to: [leadTo],
        subject: `[Diagnostic Review] ${payload.caseType} / ${payload.urgency} / ${requestId}`,
        text: message,
        attachments: preparedFiles.attachments.map((file) => ({
          filename: file.filename,
          content: file.content,
          contentType: file.contentType,
        })),
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Notification failed" }, { status: 502 });
    }
  } else {
    console.info("[Diagnostic Review Mock]", message);
  }

  return NextResponse.json({ ok: true, requestId });
}
