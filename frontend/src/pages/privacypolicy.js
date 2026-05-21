import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-8 sm:p-10">
          <div className="border-b border-gray-200 pb-6 mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              <strong>Last Updated:</strong> May 21, 2026
            </p>
          </div>

          <div className="space-y-8 text-gray-700">
            <section className="prose prose-blue max-w-none">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                1. SMS Opt-In and Text Messaging Privacy
              </h3>
              <p className="mb-4 leading-relaxed">
                The Final Seat LLC values your privacy. Mobile phone numbers collected for the purpose of SMS opt-in, automated flight notifications, or booking support updates will be used exclusively to deliver the specific services requested by the consumer. 
              </p>
              <p className="leading-relaxed">
                No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.
              </p>
            </section>

            <section className="prose prose-blue max-w-none">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">2. Information We Collect</h3>
              <p className="leading-relaxed">
                THE FINAL SEAT LLC respects your privacy. We collect the personal information strictly
                necessary to facilitate your travel arrangements. This includes your contact details,
                passenger details, and itinerary preferences required to process inbound flight reservations.
              </p>
            </section>

            <section className="prose prose-blue max-w-none">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">3. How We Use and Share Data</h3>
              <p className="leading-relaxed">
                We use your information solely to fulfill your flight bookings, coordinate with our
                authorized suppliers, and share operational updates related to your travel plan. We
                share necessary passenger details strictly with the respective airlines, consolidators,
                and Global Distribution Systems (GDS) required to issue your tickets. We do not sell
                or trade your data to third-party marketers.
              </p>
            </section>

            <section className="prose prose-blue max-w-none">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">4. Payment Security</h3>
              <p className="leading-relaxed">
                Your financial security is our priority. Payment data is processed through secure,
                PCI-DSS compliant payment gateways (such as Authorize.net). We utilize secure
                tokenization and do not store full credit card numbers on our servers at any time.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;