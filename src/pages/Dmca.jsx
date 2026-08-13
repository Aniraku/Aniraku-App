import { useEffect } from 'react'
import LegalPage from '../components/LegalPage/LegalPage'
import { setStaticPageSEO } from '../lib/seo'

const sections = [
  { id: 'scope', label: 'What we control' },
  { id: 'notice', label: 'Submit a notice' },
  { id: 'review', label: 'Review process' },
  { id: 'counter', label: 'Counter-notice' },
  { id: 'community', label: 'Community content' },
]

const Dmca = () => {
  useEffect(() => { setStaticPageSEO('Copyright & DMCA Notices', '/dmca') }, [])

  return (
    <LegalPage
      title="Copyright & DMCA"
      eyebrow="Copyright & content reports"
      revision="August 13, 2026"
      intro="This page explains how to report a copyright concern or community-content issue to the Aniraku project. It is written for transparency and intake; it is not a promise that every notice creates a legal obligation in every jurisdiction."
      sections={sections}
    >
      <h2 id="scope">1. What Aniraku controls</h2>
      <p>Aniraku is an open-source discovery and playback client. It uses third-party metadata and source-resolution paths; it does not intentionally host or maintain a permanent library of episode files on Aniraku servers. We cannot delete a file from an unrelated third-party host through an Aniraku notice.</p>
      <p>When a valid concern identifies a specific Aniraku-controlled page, metadata record, resolver path, comment, profile, or other project-controlled surface, we can review what the client or service exposes and may restrict, correct, or remove that surface where appropriate.</p>

      <h2 id="notice">2. What to include in a copyright notice</h2>
      <p>Send a notice to <a href="mailto:dmca@aniraku.app">dmca@aniraku.app</a>. If email delivery is unavailable, use a private contact route from the project maintainers; do not post personal legal documents or private contact information in a public GitHub issue.</p>
      <p>A useful notice should include all of the following:</p>
      <ol>
        <li>Your name, organization, and contact information.</li>
        <li>A description or identification of the copyrighted work you represent.</li>
        <li>The exact Aniraku URL, title, anime ID, episode reference, or comment URL at issue. Screenshots may help, but a screenshot alone is not a precise location.</li>
        <li>A good-faith statement that the challenged use is not authorized by the copyright owner, its agent, or the law.</li>
        <li>A statement that the information is accurate and, where applicable, that you are authorized to act for the owner.</li>
        <li>Your physical or electronic signature.</li>
      </ol>
      <p>Do not send passwords, payment details, identity documents, or unrelated private information. Use a professional contact address and redact sensitive material unless it is genuinely needed for review.</p>

      <h2 id="review">3. Review and response</h2>
      <p>We may acknowledge receipt, request missing information, compare the report with the relevant project data, and take proportionate action. Possible actions include correcting or hiding a metadata link, restricting a resolver path, removing community content, or explaining why the reported material is not controlled by Aniraku.</p>
      <p>We cannot guarantee a response time, a particular remedy, or removal from third-party hosts. Repeat, fraudulent, incomplete, or abusive notices may be declined. When appropriate, we may preserve records needed to investigate abuse or comply with law.</p>

      <h2 id="counter">4. Counter-notices</h2>
      <p>If an Aniraku-controlled page or community item was restricted in error, you may reply with the specific material, the reason you believe the action was mistaken, your contact information, and any statement or signature required by the law that applies to your situation. A counter-notice may be shared with the reporting party where required or appropriate. Obtain legal advice before submitting a formal counter-notice if the consequences matter to you.</p>

      <h2 id="community">5. Community and safety reports</h2>
      <p>For harassment, threats, spam, doxxing, malware, or other community violations, use the <a href="https://github.com/Aniraku/Aniraku/issues" target="_blank" rel="noreferrer">Aniraku issue tracker</a> with the relevant URL and a concise description. Read the <a href="/community-guidelines">Community Guidelines</a> first. Emergency or immediate safety concerns should be reported to the appropriate local emergency or law-enforcement service; Aniraku is not an emergency-response channel.</p>
    </LegalPage>
  )
}

export default Dmca
