import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import LegalPage from '../components/LegalPage/LegalPage'
import { setStaticPageSEO } from '../lib/seo'

const sections = [
  { id: 'be-human', label: 'Be human' },
  { id: 'not-allowed', label: 'Not allowed' },
  { id: 'reports', label: 'Reports' },
  { id: 'privacy', label: 'Privacy & safety' },
]

const CommunityGuidelines = () => {
  useEffect(() => { setStaticPageSEO('Community Guidelines', '/community-guidelines') }, [])

  return (
    <LegalPage
      title="Community Guidelines"
      eyebrow="Community & safety"
      revision="August 13, 2026"
      intro="Aniraku’s community should make it easier to talk about anime, not harder to feel safe. These guidelines apply to comments, replies, profiles, ratings, and any other community contribution."
      sections={sections}
    >
      <h2 id="be-human">1. Be human</h2>
      <p>Talk about the show, the scene, or the idea. Disagree without targeting the person. Keep spoilers clearly marked when a reasonable viewer could encounter them before watching. Give other users room to enjoy different genres, languages, dubs, subtitles, and opinions.</p>

      <h2 id="not-allowed">2. What is not allowed</h2>
      <ul>
        <li>Harassment, threats, hate, sexual exploitation, or content involving minors.</li>
        <li>Doxxing, personal information, impersonation, or attempts to identify private users.</li>
        <li>Spam, scams, referral abuse, malware, phishing, or links intended to compromise devices.</li>
        <li>Copyright-infringing uploads, stolen personal material, or instructions to attack the service.</li>
        <li>Repeated spoilers, deliberate misinformation, brigading, or attempts to evade a moderation action.</li>
      </ul>
      <p>GIF reactions are optional decoration. Choose them as you would choose words: do not use them to harass someone, evade filters, or post content that would violate these guidelines if written out.</p>

      <h2 id="reports">3. Reporting and moderation</h2>
      <p>Report a community post or reply when it violates these guidelines. For a product or playback defect, use the <a href="https://github.com/Aniraku/Aniraku/issues" target="_blank" rel="noreferrer">project issue tracker</a>. For copyright notices, use the <Link to="/dmca">DMCA & content-report page</Link>.</p>
      <p>Reports should include the relevant URL, a concise description, and only the information needed to investigate. Maintainers may remove content, limit posting, suspend accounts, or take no action when a report does not establish a violation. Do not use public issues to post passwords, private legal documents, or personal contact details.</p>

      <h2 id="privacy">4. Privacy and safety</h2>
      <p>Do not publish your email address, location, school, phone number, account credentials, private messages, or another person’s personal information. Read the <Link to="/privacy">Privacy Policy</Link> to understand account data and local storage, and use Settings to clear supported history or delete your account.</p>
    </LegalPage>
  )
}

export default CommunityGuidelines
