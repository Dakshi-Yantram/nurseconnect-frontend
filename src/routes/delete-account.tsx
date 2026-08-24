import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/delete-account")({
  component: DeleteAccountPage,
  head: () => ({ meta: [{ title: "Delete Your Account — NurseConnect" }] }),
});

function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-6 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold">
            NurseConnect
          </Link>
          <span className="text-sm text-muted-foreground">Delete Account</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 text-[15px] leading-7 text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1.5 [&_a]:text-primary [&_a]:underline">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Delete Your NurseConnect Account</h1>
        <p className="text-sm text-muted-foreground mb-8">
          This page explains how to request deletion of your NurseConnect account and data.
        </p>

        <h2>How to request deletion</h2>
        <p>
          To request that your account and associated data be deleted, send an email to{" "}
          <a href="mailto:privacy@nurseconnect.co.in">privacy@nurseconnect.co.in</a> from the
          email address or phone number registered on your account, with the subject line
          "Account Deletion Request". Include your registered phone number so we can locate
          your account.
        </p>
        <p>
          We will verify your identity and confirm your request within a few business days.
          Once verified, your account will be deactivated and scheduled for deletion.
        </p>

        <h2>What gets deleted</h2>
        <p>Upon a verified deletion request, we delete or irreversibly anonymize:</p>
        <ul>
          <li>Your profile information (name, phone number, email, photo)</li>
          <li>Saved addresses and patient/family member records you added</li>
          <li>In-app messages and call history</li>
          <li>Linked ABHA/health ID references</li>
        </ul>

        <h2>What we retain, and why</h2>
        <p>
          Some information cannot be deleted immediately and is retained for a limited period
          as required by law or legitimate business need, including:
        </p>
        <ul>
          <li>
            Booking, visit, and payment records — retained for accounting, tax, and healthcare
            recordkeeping obligations.
          </li>
          <li>
            Information relevant to an open dispute, complaint, or safety investigation — retained
            until that matter is resolved.
          </li>
          <li>Fraud-prevention and security logs — retained for a limited period as required by law.</li>
        </ul>
        <p>
          This retained data is kept only as long as necessary for these purposes and is not used
          for any other purpose. For details on how we handle data generally, see our{" "}
          <Link to="/privacy-policy">Privacy Policy</Link>.
        </p>

        <h2>Timeline</h2>
        <p>
          Deletable data is removed within 30 days of a verified request. Data subject to legal
          retention requirements is deleted at the end of the applicable retention period.
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