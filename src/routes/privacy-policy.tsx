import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyPage,
  head: () => ({ meta: [{ title: "Privacy Policy — NurseConnect" }] }),
});

const LAST_UPDATED = "August 24, 2026";

function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-6 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold">
            NurseConnect
          </Link>
          <span className="text-sm text-muted-foreground">Privacy Policy</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 text-[15px] leading-7 text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1.5 [&_a]:text-primary [&_a]:underline">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {LAST_UPDATED}</p>

        <p>
          NurseConnect ("NurseConnect", "we", "us", or "our") operates the NurseConnect
          mobile application and website (together, the "Service"), which connects patients
          and families with nurses and caregiving professionals for home healthcare visits.
          This Privacy Policy explains what information we collect, how we use it, and the
          choices you have.
        </p>
        <p>
          By creating an account or using the Service, you agree to the collection and use
          of information in accordance with this policy. If you do not agree, please do not
          use the Service.
        </p>

        <h2>1. Information We Collect</h2>

        <h3>1.1 Information you provide to us</h3>
        <ul>
          <li><strong>Account information:</strong> name, phone number, email address, password, and profile photo.</li>
          <li><strong>Identity and verification information:</strong> for caregiving partners, government ID, qualification certificates, and background verification documents.</li>
          <li><strong>Health and care information:</strong> patient details, medical history, prescriptions, care plans, visit notes, safety checklists, and other health information you or your care team provide to enable a booking or visit.</li>
          <li><strong>ABHA / health ID information:</strong> if you choose to link your Ayushman Bharat Health Account (ABHA) or similar health ID, we access and store the information you authorize.</li>
          <li><strong>Address and location:</strong> home or visit addresses you add for bookings.</li>
          <li><strong>Payment information:</strong> we use Razorpay to process payments. We do not store your full card, UPI, or bank account details on our servers — these are handled directly by Razorpay in accordance with their own privacy policy.</li>
          <li><strong>Communications:</strong> messages, call logs, and support tickets exchanged through the Service.</li>
        </ul>

        <h3>1.2 Information collected automatically</h3>
        <ul>
          <li><strong>Device information:</strong> device type, operating system, unique device identifiers, and app version.</li>
          <li><strong>Usage data:</strong> pages and screens viewed, features used, and timestamps.</li>
          <li><strong>Location data:</strong> with your permission, precise or approximate location to match you with nearby nurses, track visit check-in/check-out, and improve service reliability.</li>
          <li><strong>Log and diagnostic data:</strong> crash reports and performance data.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To create and manage your account and verify your identity.</li>
          <li>To match patients with suitable nurses/caregivers and facilitate bookings and visits.</li>
          <li>To process payments and payouts, including through Razorpay.</li>
          <li>To enable safety features such as OTP-based visit verification, safety checklists, and incident reporting.</li>
          <li>To communicate with you about bookings, visits, support requests, and service updates.</li>
          <li>To conduct background verification of caregiving partners.</li>
          <li>To monitor, maintain, and improve the safety, quality, and performance of the Service.</li>
          <li>To detect, prevent, and address fraud, abuse, or technical issues.</li>
          <li>To comply with applicable legal and regulatory obligations, including healthcare recordkeeping requirements.</li>
        </ul>

        <h2>3. How We Share Your Information</h2>
        <p>We do not sell your personal information. We share information only as follows:</p>
        <ul>
          <li><strong>With nurses/caregiving partners:</strong> relevant patient and visit information necessary to safely deliver care.</li>
          <li><strong>With patients/families:</strong> relevant partner information (name, photo, qualifications, verification status) to support a booking.</li>
          <li><strong>With service providers:</strong> payment processing (Razorpay), cloud hosting, SMS/OTP delivery, and analytics providers who process data on our behalf under contractual confidentiality obligations.</li>
          <li><strong>With health information exchanges:</strong> such as the ABHA ecosystem, only where you have opted in.</li>
          <li><strong>For legal reasons:</strong> where required by law, regulation, legal process, or governmental request, or to protect the rights, safety, and property of NurseConnect, our users, or the public.</li>
          <li><strong>Business transfers:</strong> in connection with a merger, acquisition, or sale of assets, subject to this policy or a comparable one.</li>
        </ul>

        <h2>4. Data Retention</h2>
        <p>
          We retain personal and health information for as long as your account is active or
          as needed to provide the Service, comply with our legal and regulatory obligations
          (including healthcare recordkeeping requirements), resolve disputes, and enforce our
          agreements. You may request deletion of your account as described in Section 6.
        </p>

        <h2>5. Data Security</h2>
        <p>
          We use reasonable administrative, technical, and physical safeguards designed to
          protect your information, including encryption in transit, access controls, and
          OTP-based verification for sensitive actions. No method of transmission or storage
          is completely secure, and we cannot guarantee absolute security.
        </p>

        <h2>6. Your Rights and Choices</h2>
        <ul>
          <li><strong>Access and correction:</strong> you may review and update your profile information within the app.</li>
          <li><strong>Deletion:</strong> you may request deletion of your account and associated data by contacting us at the email below, subject to legal retention requirements.</li>
          <li><strong>Location and notifications:</strong> you can control location and notification permissions through your device settings.</li>
          <li><strong>Marketing communications:</strong> you may opt out of promotional messages while still receiving essential service communications.</li>
        </ul>

        <h2>7. Children's Privacy</h2>
        <p>
          The Service is not directed to children under 18. Care bookings for minors must be
          made and managed by a parent or legal guardian, who is responsible for the accuracy
          of the minor's information provided to us.
        </p>

        <h2>8. Third-Party Services</h2>
        <p>
          The Service integrates with third-party providers, including Razorpay for payments
          and, where applicable, ABHA/health ID services. These providers have their own
          privacy policies governing the information they process, and we encourage you to
          review them.
        </p>

        <h2>9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of material
          changes by updating the "Last updated" date above and, where appropriate, through
          the app or by email. Continued use of the Service after changes take effect
          constitutes acceptance of the updated policy.
        </p>

        <h2>10. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or wish to exercise your rights,
          contact us at:
        </p>
        <p>
          Email: <a href="mailto:privacy@nurseconnect.co.in">privacy@nurseconnect.co.in</a>
        </p>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} NurseConnect. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
