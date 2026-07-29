import { CredentialsSignin } from "next-auth";

/** Thrown from authorize() when a password is correct but an emailed 2FA code is still needed. */
export class TwoFactorRequiredEmailError extends CredentialsSignin {
  code = "TwoFactorRequiredEmail";
}

/** Thrown from authorize() when a password is correct but an authenticator-app code is still needed. */
export class TwoFactorRequiredTotpError extends CredentialsSignin {
  code = "TwoFactorRequiredTotp";
}

/** Thrown from authorize() when a submitted 2FA code is wrong/expired/locked. */
export class InvalidTwoFactorCodeError extends CredentialsSignin {
  code = "InvalidTwoFactorCode";
}
