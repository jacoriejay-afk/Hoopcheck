import Link from "next/link";

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash: tokenHash, type } = await searchParams;
  const valid = typeof tokenHash === "string" && /^[a-f0-9]{56,128}$/i.test(tokenHash)
    && (type === "email" || type === "signup");

  return (
    <main className="hc-auth-page">
      <section className="hc-auth-form-section">
        <div className="hc-auth-card">
          <h1>Confirm your email</h1>
          {valid ? (
            <form method="post" action="/auth/confirm/verify">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={type} />
              <button className="btn hc-auth-submit" type="submit">Confirm email</button>
            </form>
          ) : (
            <>
              <p role="alert">This confirmation link is incomplete. Open the latest email from HoopCheck.</p>
              <Link href="/login">Back to sign in</Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
