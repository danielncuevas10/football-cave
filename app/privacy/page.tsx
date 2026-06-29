import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy – FootballCave",
  description:
    "How FootballCave collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  const lastUpdated = "June 5, 2026";

  return (
    <div className="min-h-screen bg-background text-white">
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-200 text-sm mb-10">
          Last updated: {lastUpdated}
        </p>

        <section className="space-y-8 text-gray-300 leading-relaxed">
          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              1. Introduction
            </h2>
            <p>
              Welcome to FootballCave (&quot;we,&quot; &quot;our,&quot; or
              &quot;us&quot;). We operate the website FootballCave (the
              &quot;Service&quot;). This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you visit our
              website. Please read this policy carefully. If you disagree with
              its terms, please discontinue use of the Service.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              2. Information We Collect
            </h2>
            <h3 className="font-medium text-white mb-2">
              Automatically Collected Data
            </h3>
            <p className="mb-3">
              When you visit FootballCave, certain information is collected
              automatically, including:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Browser type and version</li>
              <li>Operating system</li>
              <li>Pages visited and time spent on each page</li>
              <li>Referring URL</li>
              <li>IP address (anonymized)</li>
              <li>Device type and screen resolution</li>
            </ul>
            <h3 className="font-medium text-white mt-4 mb-2">
              Account Data (if applicable)
            </h3>
            <p>
              If you create an account, we collect your email address and any
              profile information you choose to provide. We use Supabase to
              manage authentication securely.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              3. How We Use Your Information
            </h2>
            <p className="mb-3">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Operate and improve the Service</li>
              <li>Analyze usage patterns to enhance user experience</li>
              <li>Display relevant advertisements</li>
              <li>Prevent fraud and abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              4. Cookies and Tracking Technologies
            </h2>
            <p className="mb-3">
              We and our third-party partners use cookies and similar tracking
              technologies to track activity on our Service. You can instruct
              your browser to refuse all cookies or to indicate when a cookie is
              being sent.
            </p>
            <p>Types of cookies we use:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>
                <strong className="text-white">Essential cookies</strong> –
                required for the Service to function (e.g., authentication
                sessions).
              </li>
              <li>
                <strong className="text-white">Analytics cookies</strong> – help
                us understand how visitors interact with the Service (via Vercel
                Analytics).
              </li>
              <li>
                <strong className="text-white">Advertising cookies</strong> –
                used by Google AdSense to serve relevant ads based on your
                interests.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              5. Google AdSense and Advertising
            </h2>
            <p className="mb-3">
              We use Google AdSense to display advertisements on our Service.
              Google AdSense uses cookies to serve ads based on your prior
              visits to our website and other sites on the Internet.
              Google&apos;s use of advertising cookies enables it and its
              partners to serve ads based on your visit to our site and/or other
              sites on the Internet.
            </p>
            <p className="mb-3">
              You may opt out of personalized advertising by visiting{" "}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                Google Ads Settings
              </a>
              . You can also opt out via{" "}
              <a
                href="https://www.aboutads.info/choices/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                aboutads.info
              </a>
              .
            </p>
            <p>
              Google&apos;s Privacy Policy is available at{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                policies.google.com/privacy
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              6. Third-Party Services
            </h2>
            <p className="mb-3">We use the following third-party services:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong className="text-white">Vercel Analytics</strong> –
                privacy-friendly website analytics.
              </li>
              <li>
                <strong className="text-white">Supabase</strong> – database and
                authentication infrastructure.
              </li>
              <li>
                <strong className="text-white">Google AdSense</strong> –
                advertising network.
              </li>
              <li>
                <strong className="text-white">API-Football</strong> – football
                match data provider.
              </li>
            </ul>
            <p className="mt-3">
              Each of these services has its own privacy policy governing their
              use of your data. We encourage you to review their respective
              policies.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              7. Data Retention
            </h2>
            <p>
              We retain your personal data only as long as necessary to provide
              the Service and fulfill the purposes outlined in this policy,
              unless a longer retention period is required by law.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              8. Your Rights
            </h2>
            <p className="mb-3">
              Depending on your location, you may have the following rights
              regarding your personal data:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Right to access the data we hold about you</li>
              <li>Right to correct inaccurate data</li>
              <li>Right to request deletion of your data</li>
              <li>Right to restrict or object to processing</li>
              <li>Right to data portability</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please contact us at the email
              below.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              9. Children&apos;s Privacy
            </h2>
            <p>
              FootballCave is not directed to children under the age of 13. We
              do not knowingly collect personal information from children under
              13. If you are a parent or guardian and believe your child has
              provided us with personal data, please contact us so we can delete
              it.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of any changes by updating the &quot;Last updated&quot;
              date at the top of this page. Your continued use of the Service
              after any changes constitutes your acceptance of the new policy.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              11. Contact Us
            </h2>
            <p>
              If you have any questions about this Privacy Policy, please
              contact us at:{" "}
              <a
                href="mailto:football.cave.customers@gmail.com"
                className="text-blue-400 hover:underline"
              >
                football.cave.customers@gmail.com
              </a>
            </p>
          </div>
        </section>

        <div className="mt-12 pt-6 border-t border-[#303030]">
          <Link
            href="/"
            className="text-gray-200 hover:text-white text-sm transition-colors"
          >
            ← Back to FootballCave
          </Link>
        </div>
      </main>
    </div>
  );
}
