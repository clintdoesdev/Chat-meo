import type { Metadata } from "next";
import Link from "next/link";
import { ActionsCheckIcon, StatusWarningIcon } from "@/components/icons";
import { LandingNav } from "@/components/landing/landing-nav";

export const metadata: Metadata = {
  title: "Privacy Policy — Chatmeo",
  description: "How Chatmeo collects, uses, and protects information for account holders and the people who chat with their bots.",
};

const TOC = [
  { id: "scope", label: "Who this policy covers" },
  { id: "collect", label: "Information we collect" },
  { id: "use", label: "How we use it" },
  { id: "ai", label: "AI providers & message content" },
  { id: "whatsapp", label: "WhatsApp Business Platform" },
  { id: "share", label: "Who we share data with" },
  { id: "retain", label: "Retention & deletion" },
  { id: "security", label: "Security" },
  { id: "rights", label: "Your rights & choices" },
  { id: "children", label: "Children's privacy" },
  { id: "transfers", label: "International transfers" },
  { id: "changes", label: "Changes to this policy" },
  { id: "contact", label: "Contact us" },
];

function Section({
  id,
  num,
  title,
  children,
}: {
  id: string;
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-9 first:border-t-0 first:pt-0">
      <h2 className="mb-3.5 flex items-baseline gap-2.5 text-[19px] font-extrabold tracking-[-0.01em]">
        <span className="flex-shrink-0 text-[13px] font-bold text-orange-2">{num}</span>
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-[14.5px] leading-relaxed text-[#cfcfcf] [&_a]:text-orange-2 [&_a:hover]:underline [&_h3]:mt-2 [&_h3]:text-[14px] [&_h3]:font-bold [&_h3]:text-text [&_li]:mb-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:max-w-[68ch] [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-[13px] border border-line-2">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap border-b border-line-2 bg-card-2 px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-[.05em] text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border-b border-line px-3.5 py-2.5 align-top last:border-b-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-full">
      <LandingNav />

      <div className="mx-auto max-w-[760px] px-[22px] py-14">
        <div className="mb-8 flex items-center justify-between gap-3">
          <span className="rounded-full border border-line-2 bg-card-2 px-3 py-1 text-[11.5px] font-semibold text-muted [font-variant-numeric:tabular-nums]">
            Effective August 9, 2026 · v1.0
          </span>
        </div>

        <div className="mb-8 flex items-start gap-2.5 rounded-[14px] border border-orange-2/30 bg-orange/[.08] p-4 text-[13px] leading-relaxed">
          <StatusWarningIcon size={15} className="mt-0.5 flex-shrink-0 text-orange-2" />
          <p>
            This policy has not yet been reviewed by outside legal counsel. It accurately
            describes what Chatmeo collects and who it&apos;s shared with, but shouldn&apos;t be
            treated as a substitute for professional legal review before relying on it at scale.
          </p>
        </div>

        <h1 className="mb-2.5 text-[32px] font-extrabold tracking-[-0.015em]">Privacy Policy</h1>
        <p className="mb-9 max-w-[60ch] text-[15px] text-muted">
          How Chatmeo collects, uses, and protects information — for the businesses who build
          bots with us, and the people who chat with those bots.
        </p>

        <div className="mb-9 rounded-[16px] border border-line bg-card p-5">
          <h2 className="mb-3 text-[11.5px] font-bold uppercase tracking-[.06em] text-muted">In short</h2>
          <ul className="flex flex-col gap-2.5">
            {[
              "We store your account, bot configuration, and conversation history for as long as your account is active.",
              "Message content is sent to an AI provider (xAI or OpenRouter) to generate bot replies, and to Meta's WhatsApp Business Platform to deliver and receive WhatsApp messages.",
              "WhatsApp access tokens are encrypted at rest and deleted the moment you disconnect a number.",
              "We don't sell personal information, to anyone, ever.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-[14px] leading-relaxed">
                <ActionsCheckIcon size={14} className="mt-0.5 flex-shrink-0 text-orange-2" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <nav className="mb-10 rounded-[16px] border border-line bg-card p-5">
          <h2 className="mb-3 text-[11.5px] font-bold uppercase tracking-[.06em] text-muted">Contents</h2>
          <ol className="grid grid-cols-1 gap-x-6 gap-y-1.5 min-[560px]:grid-cols-2">
            {TOC.map((item, i) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-[13.5px] text-[#cfcfcf] hover:text-orange-2">
                  <span className="mr-1.5 text-muted [font-variant-numeric:tabular-nums]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex flex-col gap-9">
          <Section id="scope" num="01" title="Who this policy covers">
            <p>
              This policy applies to two different people, and we&apos;re specific below about
              which one each section means:
            </p>
            <ul>
              <li>
                <strong className="text-text">Account holders</strong> — the businesses and
                individuals who sign up for Chatmeo to build and operate a bot (referred to here
                as &quot;you,&quot; &quot;your bot&quot;).
              </li>
              <li>
                <strong className="text-text">End users</strong> — the customers, visitors, or
                contacts who chat with a bot built on Chatmeo, whether through an embedded
                website widget or a connected WhatsApp number.
              </li>
            </ul>
            <p>
              If you&apos;re an end user chatting with a Chatmeo-powered bot, the business
              you&apos;re messaging is the one responsible for that conversation and its own
              privacy practices — Chatmeo processes that conversation on their behalf, as
              described below.
            </p>
          </Section>

          <Section id="collect" num="02" title="Information we collect">
            <h3>From account holders</h3>
            <Table
              head={["Category", "Examples"]}
              rows={[
                ["Account", "Name, email address, hashed password, profile image"],
                [
                  "Bot configuration",
                  "Flows, prompts, welcome messages, uploaded knowledge-base documents, branding/theme choices",
                ],
                [
                  "WhatsApp connection",
                  "WhatsApp Business Account ID, phone number ID, display phone number, an encrypted long-lived access token",
                ],
                ["Usage", "Conversation counts, message volume, login activity, feature usage"],
                [
                  "Security",
                  "Two-factor authentication method and (if enabled) an encrypted authenticator secret",
                ],
              ]}
            />
            <h3>From end users chatting with a bot</h3>
            <Table
              head={["Category", "Examples"]}
              rows={[
                [
                  "Conversation content",
                  "Messages sent to and received from the bot, and a per-visitor or per-contact identifier used to keep a conversation's history together",
                ],
                [
                  "WhatsApp identifiers",
                  "If messaging via WhatsApp: your WhatsApp ID (phone number) and the message timestamps Meta provides",
                ],
                [
                  "Widget technical data",
                  "If chatting via an embedded widget: the domain the widget was loaded from, for basic abuse prevention",
                ],
              ]}
            />
          </Section>

          <Section id="use" num="03" title="How we use it">
            <ul>
              <li>
                Operate the service: run your bot&apos;s flows, generate replies, and deliver
                them over the channel a conversation came in on.
              </li>
              <li>Maintain your account: authentication, two-factor verification, password resets, service emails.</li>
              <li>Keep a conversation history so an account holder&apos;s inbox reflects what customers actually said.</li>
              <li>Enforce usage limits and prevent abuse of the platform.</li>
              <li>
                Improve reliability and fix problems — we look at aggregated usage and error data,
                not individual conversation content, for this.
              </li>
            </ul>
          </Section>

          <Section id="ai" num="04" title="AI providers & message content">
            <p>
              When a bot uses an AI-generated response, the relevant conversation history and
              your configured system prompt are sent to a third-party AI provider — currently{" "}
              <strong className="text-text">xAI</strong> (Grok) or{" "}
              <strong className="text-text">OpenRouter</strong>, depending on how the bot is
              configured — to generate the reply. That provider processes the request and
              returns a response; it does not use your conversations to improve models we
              don&apos;t control, beyond whatever that provider&apos;s own terms specify.
            </p>
            <p>
              Uploaded knowledge-base documents attached to an AI-enabled part of a flow are
              stored as extracted text and included the same way, only when relevant to
              generating a reply.
            </p>
          </Section>

          <Section id="whatsapp" num="05" title="WhatsApp Business Platform">
            <p>Connecting a bot to WhatsApp uses Meta&apos;s Embedded Signup flow. When an account holder connects a number:</p>
            <ul>
              <li>
                Chatmeo receives a long-lived access token from Meta, which is{" "}
                <strong className="text-text">encrypted at rest</strong> and used only to send
                messages and manage the webhook subscription for that number.
              </li>
              <li>
                Inbound WhatsApp messages arrive through Meta&apos;s webhook platform; Chatmeo
                verifies each delivery is genuinely from Meta before processing it.
              </li>
              <li>
                Automated replies are only sent within the messaging window Meta&apos;s platform
                allows (currently 24 hours from the customer&apos;s last message) — outside that
                window, we don&apos;t attempt to send one.
              </li>
              <li>
                An account holder can pause automated replies at any time without affecting the
                underlying Meta connection, or fully disconnect — which revokes Chatmeo&apos;s
                access with Meta and immediately deletes the stored token.
              </li>
            </ul>
            <p>
              Meta&apos;s own{" "}
              <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer">
                WhatsApp Business Policy
              </a>{" "}
              and{" "}
              <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">
                Meta Privacy Policy
              </a>{" "}
              also apply to how Meta handles data in transit through WhatsApp.
            </p>
          </Section>

          <Section id="share" num="06" title="Who we share data with">
            <p>
              We share information only with the service providers that make Chatmeo work,
              under agreements that limit what they can do with it — never for advertising, and
              never sold.
            </p>
            <Table
              head={["Provider", "Purpose"]}
              rows={[
                ["Meta / WhatsApp Business Platform", "Sending and receiving WhatsApp messages you've connected"],
                ["xAI / OpenRouter", "Generating AI bot replies"],
                ["Resend", "Transactional email (verification, password reset, notifications)"],
                ["Database & hosting infrastructure", "Storing and serving the application and its data"],
              ]}
            />
            <p>
              We may also disclose information if required by law, or to protect the rights,
              safety, or property of Chatmeo, our users, or the public.
            </p>
          </Section>

          <Section id="retain" num="07" title="Retention & deletion">
            <ul>
              <li>Account and bot data is retained for as long as the account is active.</li>
              <li>
                Conversation history is retained so account holders can review it in their
                inbox, until the account holder deletes it or closes their account.
              </li>
              <li>A WhatsApp access token is deleted immediately on disconnect — not just deactivated.</li>
              <li>
                Account holders can request deletion of their account and associated data by
                contacting us <a href="#contact">below</a>.
              </li>
            </ul>
          </Section>

          <Section id="security" num="08" title="Security">
            <ul>
              <li>Passwords are hashed, never stored in plain text.</li>
              <li>
                WhatsApp access tokens are encrypted at rest (AES-256-GCM) with a key separate
                from the one used for authentication secrets, so rotating one never exposes the
                other.
              </li>
              <li>Data in transit is encrypted (HTTPS/TLS).</li>
              <li>Optional two-factor authentication (email code or authenticator app) is available on every account.</li>
            </ul>
            <p>
              No system is perfectly secure, but we design storage of anything sensitive —
              tokens, passwords, verification codes — around the assumption that a breach of the
              database alone shouldn&apos;t hand over anything usable.
            </p>
          </Section>

          <Section id="rights" num="09" title="Your rights & choices">
            <p>
              Depending on where you live, you may have rights to access, correct, export, or
              delete your personal information, and to object to or restrict certain processing:
            </p>
            <ul>
              <li>
                If you&apos;re in the European Economic Area or United Kingdom, these rights are
                given to you under the General Data Protection Regulation (GDPR).
              </li>
              <li>
                If you&apos;re a California resident, you have similar rights under the California
                Consumer Privacy Act (CCPA/CPRA), including the right to know what personal
                information we&apos;ve collected and to request its deletion.
              </li>
              <li>
                Wherever you are, you can ask us what we hold about you, correct it, or ask us to
                delete it — we don&apos;t require you to prove a specific law applies before we&apos;ll
                act on a reasonable request.
              </li>
            </ul>
            <p>
              To exercise any of these rights, contact us using the details in{" "}
              <a href="#contact">Contact us</a>. We&apos;ll respond within 30 days.
            </p>
          </Section>

          <Section id="children" num="10" title="Children's privacy">
            <p>
              Chatmeo is not directed at children, and account holders must be old enough to
              enter a binding agreement in their jurisdiction. We don&apos;t knowingly collect
              personal information from children through account registration.
            </p>
          </Section>

          <Section id="transfers" num="11" title="International transfers">
            <p>
              Chatmeo is based in Nigeria, and the infrastructure and service providers we rely
              on — hosting, database, AI providers, WhatsApp/Meta — are located in other
              countries, including the United States. Your information may be processed outside
              the country you&apos;re in as a result. Where required, we rely on standard
              contractual protections and our providers&apos; own compliance commitments to
              safeguard data that crosses borders this way.
            </p>
          </Section>

          <Section id="changes" num="12" title="Changes to this policy">
            <p>
              If we make material changes to this policy, we&apos;ll update the effective date
              above and, where required, notify account holders directly.
            </p>
          </Section>

          <Section id="contact" num="13" title="Contact us">
            <p>Questions about this policy, or a request to access, export, or delete your data:</p>
            <p className="leading-loose">
              <strong className="text-text">Chatmeo</strong>
              <br />
              <a href="mailto:novapixelstudios001@gmail.com">novapixelstudios001@gmail.com</a>
              <br />
              Port Harcourt, Nigeria
            </p>
          </Section>
        </div>

        <footer className="mt-14 flex items-center justify-between gap-4 border-t border-line pt-6 text-[12.5px] text-muted">
          <Link href="/" className="font-semibold text-[#cfcfcf] hover:text-orange-2">
            ← Back to chatmeo
          </Link>
          <span>© 2026 Chatmeo.</span>
        </footer>
      </div>
    </div>
  );
}
