import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useForm, ValidationError } from "@formspree/react";
import { Lightbulb, Send } from "lucide-react";

export default function FeedbackPage() {
  const { t } = useTranslation();
  const FORMSFREE_ID = import.meta.env.VITE_FORMSPREE_ID;
  const { user } = useAuth();
  const [state, handleSubmit] = useForm(FORMSFREE_ID);
  const [email, setEmail] = useState(user?.email ?? "");
  const isAuthenticated = Boolean(user?.email);

  useEffect(() => {
    setEmail(user?.email ?? "");
  }, [user?.email]);

  if (state.succeeded) {
    return (
      <div className="mx-auto max-w-3xl border border-emerald-400/20 bg-emerald-400/[0.06] p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
          {t("feedback.success")}
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          {t("feedback.success")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/55">
          {t("feedback.description")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="border-b border-white/[0.08] pb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          {t("feedback.eyebrow")}
        </p>
        <h1 className="mt-3 font-serif text-4xl font-medium text-white md:text-5xl">
          {t("feedback.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
          {t("feedback.description")}
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="mt-8 border border-white/[0.08] bg-[#111109] p-6 shadow-xl md:p-8"
      >
        <div className="flex items-start gap-4 border-b border-white/[0.08] pb-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--accent-glow)] text-[var(--accent)]">
            <Lightbulb size={19} />
          </span>
          <div>
            <h2 className="font-semibold text-white">{t("feedback.title")}</h2>
            <p className="mt-1 text-xs leading-5 text-white/40">
              {t("feedback.description")}
            </p>
          </div>
        </div>
        <div className="mt-6">
          <label
            htmlFor="feedback-email"
            className="mb-2 block text-xs font-medium text-white/65"
          >
            {t("feedback.email")}
          </label>
          <input
            id="feedback-email"
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={isAuthenticated}
            required
            placeholder={t("feedback.emailPlaceholder")}
            className={`w-full border border-white/10 px-4 py-3 text-sm outline-none ${
              isAuthenticated
                ? "cursor-not-allowed bg-white/[0.03] text-white/55"
                : "bg-black/20 text-white/80 focus:border-[var(--accent)]"
            }`}
          />
          <p className="mt-2 text-[11px] text-white/35">
            {isAuthenticated
              ? t("feedback.emailAutoFilled")
              : t("feedback.emailGuestHint")}
          </p>
          <ValidationError
            prefix={t("feedback.email")}
            field="email"
            errors={state.errors}
          />
        </div>
        <div className="mt-6">
          <label
            htmlFor="feedback-message"
            className="mb-2 block text-xs font-medium text-white/65"
          >
            {t("feedback.message")}
          </label>
          <textarea
            id="feedback-message"
            name="message"
            required
            minLength={5}
            placeholder={t("feedback.messagePlaceholder")}
            className="min-h-48 w-full resize-y border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white/80 outline-none focus:border-[var(--accent)]"
          />
          <ValidationError
            prefix={t("feedback.message")}
            field="message"
            errors={state.errors}
          />
        </div>
        {state.errors && (
          <p className="mt-5 border-l-2 border-red-400/70 pl-3 text-xs text-red-300">
            {t("feedback.error")} Please try again.
          </p>
        )}
        <button
          type="submit"
          disabled={state.submitting || !email}
          className="mt-6 inline-flex items-center gap-2 bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#17130e] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={16} />{" "}
          {state.submitting ? t("feedback.sending") : t("feedback.send")}
        </button>
      </form>
    </div>
  );
}
