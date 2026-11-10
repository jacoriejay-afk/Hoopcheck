export const GOOGLE_SIGNUP_PATH = "/signup/google";
export const GOOGLE_SIGNUP_ROLE = "hoopcheck_pending_signup";
export const GOOGLE_SIGNUP_COOKIE = "hoopcheck-google-setup";

export function googleAuthMessage(code?: string | null) {
  switch (code) {
    case "email_exists":
    case "user_already_exists":
    case "identity_already_exists":
      return "That email is already registered. Sign in with your email and password, or reset your password.";
    case "access_denied":
      return "Google sign-in was canceled. You can try again or sign in with email.";
    default:
      return "We couldn't sign you in with Google. Try again, or sign in with your email and password.";
  }
}
