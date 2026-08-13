import { useEffect } from 'react'
import LegalPage from '../components/LegalPage/LegalPage'
import { setStaticPageSEO } from '../lib/seo'

const sections = [
  { id: 'license', label: 'AGPL-3.0' },
  { id: 'permissions', label: 'What you can do' },
  { id: 'network', label: 'Network use' },
  { id: 'third-party', label: 'Third-party notices' },
  { id: 'source', label: 'Source & warranty' },
]

const License = () => {
  useEffect(() => { setStaticPageSEO('AGPL-3.0 License', '/license') }, [])

  return (
    <LegalPage
      title="Open Source License"
      eyebrow="Code & attribution"
      revision="August 13, 2026"
      intro="The Aniraku source code is offered under the GNU Affero General Public License v3.0. This page summarizes the practical meaning of that license; the repository’s license file and the official GNU text control if this summary differs from the license."
      sections={sections}
    >
      <h2 id="license">1. GNU AGPL-3.0</h2>
      <p>Copyright © 2026 Aniraku Contributors. Aniraku is free software: you may redistribute it and/or modify it under the terms of the <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noreferrer">GNU Affero General Public License version 3</a>, or a later version if the applicable license notice permits it.</p>
      <p>The program is distributed in the hope that it will be useful, but <strong>without warranty</strong>, including without implied warranties of merchantability or fitness for a particular purpose. See the complete license text for the full terms.</p>

      <h2 id="permissions">2. What the license lets you do</h2>
      <ul>
        <li>Run the code for personal, educational, research, or commercial purposes, subject to the license.</li>
        <li>Study, modify, and adapt the source code.</li>
        <li>Redistribute original or modified copies under the AGPL’s conditions.</li>
        <li>Offer the software as part of a larger project while respecting the license obligations that apply to the covered code.</li>
      </ul>
      <p>Those freedoms do not grant ownership of AniList metadata, anime artwork, third-party provider code, stream files, trademarks, or user contributions. Those materials remain governed by their own rights and terms.</p>

      <h2 id="network">3. Network use and corresponding source</h2>
      <p>The AGPL includes a network interaction provision. If you run a modified version so users interact with it over a network, you generally need to provide those users an appropriate way to obtain the corresponding source code for your modified version, as described by the license.</p>
      <p>This hosted Aniraku deployment and any separate backend service may have different repositories, configuration, and provider integrations. Review the source and license notices for the exact component you modify; do not assume that changing a frontend file alone settles every licensing obligation.</p>

      <h2 id="third-party">4. Third-party notices</h2>
      <p>AniList, Supabase, Vercel, React, styled-components, player libraries, GIF providers, stream providers, artwork, titles, and trademarks belong to their respective owners. Aniraku is not affiliated with or endorsed by AniList, any anime studio, or any third-party stream host unless explicitly stated. Check the repository’s dependency and asset notices before redistributing a build.</p>

      <h2 id="source">5. Complete text, source, and warranty</h2>
      <p>The complete AGPL text is in the repository’s <code>LICENSE</code> file and on the <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noreferrer">GNU website</a>. The source repository is available at <a href="https://github.com/Aniraku/Aniraku" target="_blank" rel="noreferrer">github.com/Aniraku/Aniraku</a>. For a license question that affects a distribution, commercial use, or legal notice, have qualified counsel review the exact code and facts.</p>
    </LegalPage>
  )
}

export default License
