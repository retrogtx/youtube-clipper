export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">Terms & Conditions</h1>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-3">1. Subscription Terms</h2>
          <p>
            Your subscription will continue until terminated. 
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">2. Payment Terms</h2>
          <p>
            Payments are processed securely through our payment provider.
            Subscriptions auto-renew unless canceled.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">3. Usage Rights</h2>
          <p>
            This service is for personal use only. 
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">4. Refund Policy</h2>
          <p>
            Refunds are handled on a case-by-case basis. Contact support on iamamrit27@gmail.com within
            14 days of purchase for refund requests.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">
            5. Service Availability
          </h2>
          <p>
            We strive for 99.9% uptime but do not guarantee uninterrupted
            service. We reserve the right to modify or discontinue features.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">
            6. Limitation of Liability
          </h2>
          <p>
            Our service is provided &quot;as is&quot; without warranties. We are
            not liable for any damages arising from service use.
          </p>
        </div>
      </section>

      <p className="mt-8 text-sm text-gray-500">
        Last updated: {new Date().toLocaleDateString()}
      </p>
    </div>
  );
}
