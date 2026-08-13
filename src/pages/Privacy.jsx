import { useEffect } from 'react'
import LegalPage from '../components/LegalPage/LegalPage'
import { setStaticPageSEO } from '../lib/seo'

const sections = [
  { id: 'summary', label: 'At a glance' },
  { id: 'data', label: 'Data we handle' },
  { id: 'use', label: 'How we use it' },
  { id: 'storage', label: 'Storage & providers' },
  { id: 'choices', label: 'Your choices' },
  { id: 'retention', label: 'Retention & deletion' },
  { id: 'contact', label: 'Contact' },
]

const Privacy = () => {
  useEffect(() => { setStaticPageSEO('Privacy Policy', '/privacy') }, [])

  return (
    <LegalPage
      title="Privacy Policy"
      eyebrow="Privacy & data controls"
      revision="August 13, 2026"
      intro="This policy describes the information Aniraku’s hosted client may handle, why it is needed, which parts stay in your browser, and which parts are processed by providers. It is intentionally specific about the difference between guest use and account-backed sync."
      sections={sections}
    >
      <h2 id="summary">1. At a glance</h2>
      <p>Aniraku is designed to minimize personal data. You can browse metadata and use many discovery features without signing in. An account is needed for cloud-backed history, bookmarks, ratings, comments, profiles, and some sync features. We do not sell personal information or use watch history as an advertising profile.</p>

      <h2 id="data">2. Data we handle</h2>
      <p>Depending on how you use the product, we may handle:</p>
      <ul>
        <li><strong>Account data:</strong> email address, authentication identifiers, username, display name, avatar, and optional profile bio.</li>
        <li><strong>Library data:</strong> bookmarks, watch-history episode numbers and progress, ratings, sync settings, and connected-library identifiers when you choose to use them.</li>
        <li><strong>Community data:</strong> comments, replies, likes, reports, profile content, and moderation records associated with those contributions.</li>
        <li><strong>Browser data:</strong> local bookmarks, local watch history, player preferences, reaction cache, and settings stored in localStorage or similar browser storage when a feature uses it.</li>
        <li><strong>Technical data:</strong> request, error, security, and service-health information processed by the hosting, authentication, analytics, and infrastructure providers used by the project.</li>
      </ul>
      <p>Do not put sensitive personal information in a profile, comment, report, or support request. Anime metadata, cover art, descriptions, ratings, and airing data are obtained from third-party sources and are not personal data about you.</p>

      <h2 id="use">3. How we use information</h2>
      <p>We use information to authenticate you, synchronize the features you ask us to synchronize, display your community contributions, prevent abuse, respond to reports, improve reliability, and maintain the security of the service. We use local browser data to make guest playback and browsing convenient; local data does not automatically become cloud data until a feature syncs it.</p>
      <p>We do not sell your personal information. We do not intentionally use your watch history to infer sensitive traits or build an advertising audience. We may disclose information when necessary to provide a requested service through a provider, protect the service and users, investigate abuse, comply with law, or respond to a valid legal process.</p>

      <h2 id="storage">4. Storage and third-party providers</h2>
      <p>Authentication and application data are handled through Supabase services configured by the project. Anime metadata is fetched from AniList and other configured providers. Playback sources, external library integrations, hosting, analytics, and issue-reporting platforms have their own terms and privacy practices. A provider may receive the request data needed to answer a request, but Aniraku should not send your password to an anime metadata or GIF provider.</p>
      <p>Security depends on the configuration and availability of those providers, the browser you use, and the project’s deployment. No online system can promise absolute security. Use a unique password and sign out on shared devices.</p>

      <h2 id="choices">5. Your choices</h2>
      <p>You can browse as a guest, avoid optional sync, clear supported local storage in your browser, review bookmarks and history in Profile, disconnect supported integrations, change your password, and manage account settings. Comments and profile content should be treated as potentially public to other users. You can request review of a community item through the applicable report path.</p>
      <p>Browser privacy controls, content blockers, or disabled storage can prevent some features from working. Analytics and hosting behavior may also be affected by browser settings or deployment configuration.</p>

      <h2 id="retention">6. Retention, deletion, and children</h2>
      <p>We retain account, library, and community records for as long as needed to provide the feature, keep the service secure, resolve disputes, comply with law, or maintain legitimate operational records. Clearing browser storage does not delete cloud data, and deleting an account does not necessarily erase copies already held by third-party providers or lawful backups.</p>
      <p>Aniraku is not directed to children under 13, or the higher minimum age required in your jurisdiction. Do not create an account or submit personal information if you do not meet the applicable age requirement. A parent or guardian can contact the project about a child’s information.</p>

      <h2 id="contact">7. Contact and changes</h2>
      <p>For privacy questions or deletion-related clarification, email <a href="mailto:privacy@aniraku.app">privacy@aniraku.app</a>. For a technical privacy bug, use the <a href="https://github.com/Aniraku/Aniraku/issues" target="_blank" rel="noreferrer">private or appropriately redacted project issue path</a>; do not publish account tokens or private records.</p>
      <p>We may revise this policy when the product, providers, or legal requirements change. The revision date at the top of this page indicates which version you are reading.</p>
    </LegalPage>
  )
}

export default Privacy
