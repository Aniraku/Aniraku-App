import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import LegalPage from '../components/LegalPage/LegalPage'
import { setStaticPageSEO } from '../lib/seo'

const sections = [
  { id: 'service', label: 'The service' },
  { id: 'accounts', label: 'Accounts & sync' },
  { id: 'community', label: 'Community conduct' },
  { id: 'sources', label: 'Third-party sources' },
  { id: 'reports', label: 'Reports & enforcement' },
  { id: 'availability', label: 'Availability & limits' },
  { id: 'license', label: 'Open-source license' },
]

const Terms = () => {
  useEffect(() => { setStaticPageSEO('Terms of Service', '/terms') }, [])

  return (
    <LegalPage
      title="Terms of Service"
      revision="August 13, 2026"
      intro="These terms explain how Aniraku’s hosted web experience, open-source client, account features, community tools, and third-party data sources fit together. They are written to be readable; please review them before using an account or posting content."
      sections={sections}
    >
      <h2 id="service">1. What Aniraku is</h2>
      <p>Aniraku is an open-source anime discovery and playback client. The service uses AniList and other public metadata sources to help people find titles, view episode information, track progress, maintain bookmarks, and participate in community features.</p>
      <p><strong>Aniraku does not represent itself as the owner, studio, distributor, or official streaming service for the anime titles shown in the interface.</strong> Aniraku does not intentionally host a permanent library of episode files. Playback availability depends on third-party sources and may vary by title, device, region, or time.</p>

      <h2 id="accounts">2. Accounts, sync, and local data</h2>
      <p>You may browse much of Aniraku without an account. An account is needed for cloud-backed features such as synced watch history, ratings, bookmarks, comments, profile information, and optional external-library sync.</p>
      <p>You are responsible for keeping your login credentials secure and for activity performed through your account. Some progress and bookmark information can be stored locally in your browser for guest use. Local data may not follow you to another device until you sign in and the relevant feature has synchronized successfully.</p>
      <p>You can review or clear supported history, bookmarks, connected services, and account data from Settings. Account deletion is intended to remove the Aniraku profile data controlled by the service, but copies in backups, logs, browser storage, third-party providers, or public posts may have separate retention rules.</p>

      <h2 id="community">3. Community conduct and user content</h2>
      <p>Comments, replies, profiles, ratings, and other user-submitted material must be lawful, relevant, and respectful. Do not post harassment, threats, targeted abuse, hate, sexual material involving minors, doxxing, malware, spam, impersonation, copyright-infringing uploads, or instructions intended to compromise the service or another person’s account.</p>
      <p>You keep ownership of material you submit, but you grant Aniraku the limited permission needed to store, display, moderate, and technically distribute it as part of the community features you use. Do not submit material you do not have permission to share. GIF reactions are supplied by third-party services and should be treated as decorative reactions, not as a substitute for text or a way to evade moderation.</p>
      <p>See the <Link to="/community-guidelines">Community Guidelines</Link> for the short version of these rules.</p>

      <h2 id="sources">4. Metadata, playback, and third-party sources</h2>
      <p>Anime titles, images, descriptions, scores, airing information, and relationships are obtained from third-party metadata providers, primarily AniList. Stream resolution and playback may use public third-party sources or a configured provider route. Those providers control their own availability, content, policies, and retention.</p>
      <p>Links and metadata can be inaccurate, incomplete, stale, geo-restricted, or unavailable. Do not assume that a title, thumbnail, source label, or rating is an endorsement by Aniraku. If a source or metadata record appears unsafe, misleading, or incorrect, report it through the available issue or content-report paths.</p>

      <h2 id="reports">5. Reports, moderation, and enforcement</h2>
      <p>Use the <Link to="/dmca">DMCA & content-report page</Link> for copyright notices and the project issue tracker for product defects or source problems. Community reports may be reviewed by maintainers or moderators. We may hide, remove, restrict, or preserve content when reasonably necessary to protect users, comply with law, investigate abuse, or maintain the service.</p>
      <p>We do not promise a particular response time or outcome. Do not use a public GitHub issue for private personal information, passwords, payment details, or sensitive legal evidence.</p>

      <h2 id="availability">6. Availability, safety, and limitations</h2>
      <p>The service is provided on an “as available” basis. We may change, suspend, limit, or discontinue features; third-party failures may prevent playback or metadata access; and maintenance or abuse protection may temporarily restrict requests.</p>
      <p>You must use Aniraku only where your use of the service and the underlying third-party sources is lawful. You must not bypass access controls, overload APIs, scrape aggressively, distribute malware, interfere with another user, or use the service to facilitate unlawful activity.</p>

      <h2 id="license">7. Open-source project and changes</h2>
      <p>The Aniraku source code is distributed under the <Link to="/license">MIT License</Link>. These website terms govern use of the hosted experience; they do not replace the software license for copies of the code. We may update these terms by posting a revised version with a new revision date. Continued use after an update means you have had an opportunity to review it.</p>
    </LegalPage>
  )
}

export default Terms
