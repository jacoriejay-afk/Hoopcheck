"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { referralCodePattern, uuidPattern } from "../../../lib/ambassador/identifiers";
import { ambassadorDb, requireAmbassadorSession } from "../../../lib/ambassador/server";

const path = "/admin/ambassadors";

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function basisPoints(rate: string) {
  return /^(?:\d{1,3})(?:\.\d{1,2})?$/.test(rate) && Number(rate) <= 100
    ? Math.round(Number(rate) * 100) : null;
}

export async function changeCampaign(form: FormData) {
  const actor = await requireAmbassadorSession(path, true);
  const code = field(form, "code");
  const action = field(form, "action");
  if (!referralCodePattern.test(code) || !["link", "activate", "amend", "pause"].includes(action)) {
    redirect(`${path}?result=invalid`);
  }
  const args: Record<string, unknown> = { p_actor: actor.id, p_code: code, p_action: action };
  if (action === "link") {
    const userId = field(form, "userId");
    if (!uuidPattern.test(userId)) redirect(`${path}?result=invalid`);
    args.p_user = userId;
  }
  if (action === "activate" || action === "amend") {
    const first = basisPoints(field(form, "first"));
    const renewal = basisPoints(field(form, "renewal"));
    const date = field(form, "signed");
    const agreement = field(form, "agreement");
    const terms = field(form, "terms");
    const days = Number(field(form, "days"));
    if (first === null || renewal === null || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) || !agreement || agreement.length > 160 ||
        !terms || terms.length > 160 || (action === "activate" &&
          (!Number.isInteger(days) || days < 1 || days > 366))) redirect(`${path}?result=invalid`);
    Object.assign(args, {
      p_first: first, p_renewal: renewal, p_signed_at: date,
      p_agreement: agreement, p_terms: terms, ...(action === "activate" ? { p_days: days } : {}),
    });
  }
  const { error } = await ambassadorDb().rpc("ambassador_manage", args);
  revalidatePath(path);
  redirect(`${path}?result=${error ? "campaign-rejected" : "saved"}`);
}

export async function changePayout(form: FormData) {
  const actor = await requireAmbassadorSession(path, true);
  const ambassador = field(form, "ambassador");
  const action = field(form, "action");
  const reference = field(form, "reference");
  if (!uuidPattern.test(ambassador) || !["approve", "settle", "cancel"].includes(action) ||
      reference.length > 160 || (action === "settle" && !reference)) redirect(`${path}?result=invalid`);
  const { error } = await ambassadorDb().rpc("ambassador_payout", {
    p_ambassador: ambassador, p_currency: "usd", p_actor: actor.id, p_action: action, p_reference: reference,
  });
  revalidatePath(path);
  redirect(`${path}?result=${error ? "payout-rejected" : "saved"}`);
}
