import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service – FootballCave",
  description: "Terms and conditions for using FootballCave.",
};

export default function TermsPage() {
  const lastUpdated = "June 5, 2026";

  return (
    <div className="min-h-screen bg-background text-white">
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-200 text-sm mb-10">
          Last updated: {lastUpdated}
        </p>

        <section className="space-y-8 text-gray-300 leading-relaxed">
          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using FootballCave (&quot;the Service&quot;), you
              agree to be bound by these Terms of Service (&quot;Terms&quot;).
              If you do not agree to these Terms, please do not use the Service.
              We reserve the right to modify these Terms at any time, and your
              continued use of the Service constitutes acceptance of the updated
              Terms.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              2. Description of Service
            </h2>
            <p>
              FootballCave provides live football scores, match results,
              standings, and related sports information. The Service is provided
              for informational and entertainment purposes only. We do not offer
              any gambling, betting, or wagering services.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              3. Use of the Service
            </h2>
            <p className="mb-3">
              You agree to use the Service only for lawful purposes. You must
              not:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                Use the Service in any way that violates applicable laws or
                regulations
              </li>
              <li>
                Attempt to gain unauthorized access to any part of the Service
                or its related systems
              </li>
              <li>
                Scrape, crawl, or systematically extract data from the Service
                without our written permission
              </li>
              <li>Transmit any harmful, offensive, or disruptive content</li>
              <li>Impersonate any person or entity</li>
              <li>Interfere with the proper functioning of the Service</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              4. Intellectual Property
            </h2>
            <p>
              All content on FootballCave — including but not limited to text,
              graphics, and software — is the property of FootballCave or its
              content suppliers and is protected by applicable intellectual
              property laws. You may not reproduce, distribute, or create
              derivative works without our express written permission. Football
              data is sourced from third-party providers and is subject to their
              respective terms.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              5. Accuracy of Information
            </h2>
            <p>
              While we strive to keep match data, scores, and statistics
              accurate and up-to-date, we do not warrant that any information on
              the Service is complete, accurate, or current. FootballCave shall
              not be liable for any errors, omissions, or delays in the
              information provided.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              6. Third-Party Links and Advertising
            </h2>
            <p>
              The Service may contain links to third-party websites and display
              advertisements served by third parties, including Google AdSense.
              These third-party sites and advertisements are governed by their
              own terms and privacy policies, and we are not responsible for
              their content or practices. The display of advertisements does not
              constitute our endorsement of the advertised products or services.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              7. Disclaimer of Warranties
            </h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS
              AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
              IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR
              NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
              UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL
              COMPONENTS.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              8. Limitation of Liability
            </h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, FOOTBALLCAVE AND ITS
              OWNERS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES
              ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF
              WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              9. Termination
            </h2>
            <p>
              We reserve the right to suspend or terminate your access to the
              Service at any time, without notice, for conduct that we believe
              violates these Terms or is harmful to other users, us, or third
              parties, or for any other reason at our sole discretion.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              10. Governing Law
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with
              applicable law. Any disputes arising under these Terms shall be
              resolved through binding arbitration or in the courts of competent
              jurisdiction.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              11. Contact Us
            </h2>
            <p>
              If you have any questions about these Terms, please contact us at:{" "}
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
