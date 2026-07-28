import { CredentialsSignin } from "next-auth";

/** Thrown from authorize() when a password is correct but a 2FA code is still needed. */
export class TwoFactorRequiredError extends CredentialsSignin {
  code = "TwoFactorRequired";
}

/** Thrown from authorize() when a submitted 2FA code is wrong/expired/locked. */
export class InvalidTwoFactorCodeError extends CredentialsSignin {
  code = "InvalidTwoFactorCode";
}
