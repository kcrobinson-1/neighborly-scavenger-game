import type { FormEvent } from "react";
import type { AdminMagicLinkState } from "./useAdminDashboard";

type AdminSignInFormProps = {
  emailInput: string;
  magicLinkState: AdminMagicLinkState;
  onEmailInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

/** Magic-link request form for signed-out admin visitors. */
export function AdminSignInForm({
  emailInput,
  magicLinkState,
  onEmailInputChange,
  onSubmit,
}: AdminSignInFormProps) {
  return (
    <div className="admin-state-stack">
      <div className="section-heading">
        <p className="eyebrow">Magic-link sign-in</p>
        <h2>Send a sign-in link to an admin email.</h2>
      </div>
      <form className="admin-form" onSubmit={onSubmit}>
        <label className="admin-field" htmlFor="admin-email">
          <span className="admin-field-label">Admin email</span>
          <input
            autoComplete="email"
            className="admin-input"
            id="admin-email"
            name="email"
            onChange={(event) => onEmailInputChange(event.target.value)}
            placeholder="admin@example.com"
            type="email"
            value={emailInput}
          />
        </label>
        <button
          className="primary-button"
          disabled={magicLinkState.status === "pending"}
          type="submit"
        >
          {magicLinkState.status === "pending"
            ? "Sending sign-in link..."
            : "Email sign-in link"}
        </button>
      </form>
      {magicLinkState.message ? (
        <p
          className={
            magicLinkState.status === "error"
              ? "admin-message admin-message-error"
              : "admin-message admin-message-success"
          }
        >
          {magicLinkState.message}
        </p>
      ) : null}
    </div>
  );
}
