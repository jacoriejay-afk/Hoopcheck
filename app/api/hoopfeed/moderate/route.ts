import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PROFANITY = /\b(?:fuck|fucking|fucked|shit|bullshit|bitch|asshole|motherfucker|cunt|nigger|nigga|faggot|slut|whore)\b/i;

function blockedByLocalRules(text: string) {
  return PROFANITY.test(text);
}

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { allowed: false, message: "HoopFeed safety moderation is not configured yet. The post was not published." },
      { status: 503 }
    );
  }

  try {
    const form = await request.formData();
    const text = String(form.get("text") || "").trim();
    const image = form.get("image");

    if (blockedByLocalRules(text)) {
      return NextResponse.json({ allowed: false, message: "Please remove profanity or abusive language before posting." }, { status: 400 });
    }

    const input: any[] = [];
    if (text) input.push({ type: "text", text });
    if (image instanceof File) {
      if (!image.type.startsWith("image/")) {
        return NextResponse.json({ allowed: false, message: "Only image files can be moderated." }, { status: 400 });
      }
      if (image.size > 8 * 1024 * 1024) {
        return NextResponse.json({ allowed: false, message: "Image is too large." }, { status: 400 });
      }
      const bytes = Buffer.from(await image.arrayBuffer());
      const dataUrl = "data:" + image.type + ";base64," + bytes.toString("base64");
      input.push({ type: "image_url", image_url: { url: dataUrl } });
    }

    if (!input.length) {
      return NextResponse.json({ allowed: false, message: "Add text or a photo before posting." }, { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input })
    });

    if (!response.ok) {
      return NextResponse.json({ allowed: false, message: "Safety moderation is temporarily unavailable. Your content was not published." }, { status: 502 });
    }

    const data = await response.json();
    const result = data?.results?.[0];
    if (!result) {
      return NextResponse.json({ allowed: false, message: "Safety moderation returned no result. Your content was not published." }, { status: 502 });
    }

    if (result.flagged) {
      return NextResponse.json({
        allowed: false,
        message: "This content was blocked by HoopFeed safety moderation. Please remove sexual/nude, violent, hateful, abusive, or otherwise prohibited content and try again."
      }, { status: 400 });
    }

    return NextResponse.json({ allowed: true });
  } catch {
    return NextResponse.json({ allowed: false, message: "Safety moderation failed. Your content was not published." }, { status: 500 });
  }
}
