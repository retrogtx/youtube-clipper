export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-3">
            1. Information We Collect
          </h2>
          <p>
            We collect the minimum information required to operate the YouTube
            Clipper service. This includes your email address for account
            authentication and the URLs of the YouTube videos you choose to
            clip. We do <strong>not</strong> collect the actual video content.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">
            2. How We Use Information
          </h2>
          <p>
            Your information is used exclusively to generate and store video
            clip timestamps, manage your personal library, and improve our
            product. We never sell or share your data for advertising purposes.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">3. Cookies</h2>
          <p>
            We use cookies to keep you signed in and to remember your
            preferences. You can disable cookies in your browser settings, but
            the service may not function correctly without them.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">
            4. Third-Party Services
          </h2>
          <p>
            We rely on YouTube&#39;s public APIs to fetch video metadata. All
            interactions remain within the scope permitted by YouTube&#39;s
            Terms of Service. We also use secure payment processors to handle
            any premium subscriptions; payment details never touch our servers.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
          <p>
            Clip data and account details are retained for as long as your
            account is active. Mail us to delete your account.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
          <p>
            You have the right to access, export, or request deletion of the
            data we hold about you. Email
            <a href="mailto:iamamrit27@gmail.com" className="underline">
              privacy@ytclipper.app
            </a>
            to initiate any request.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">7. Security</h2>
          <p>
            We employ industry-standard encryption (TLS) for data in transit and
            store credentials using hashing and salting techniques. While no
            system is 100% secure, we work hard to protect your information.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">
            8. Children&#39;s Privacy
          </h2>
          <p>
            Our service is not directed to children under 13. We do not
            knowingly collect personal information from children.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">
            9. Changes to This Policy
          </h2>
          <p>
            We may update this policy periodically. Significant changes will be
            announced on the website or via email.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">10. Contact Us</h2>
          <p>
            Questions about privacy? Reach out at
            <a href="mailto:iamamrit27@gmail.com" className="underline">
              iamamrit27@gmail.com
            </a>
            .
          </p>
        </div>
      </section>

      <p className="mt-8 text-sm text-gray-500">
        Last updated: {new Date().toLocaleDateString()}
      </p>
    </div>
  );
}
