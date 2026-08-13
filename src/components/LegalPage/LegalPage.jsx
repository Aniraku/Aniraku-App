import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { FaArrowLeft, FaExternalLinkAlt, FaGithub, FaShieldAlt } from 'react-icons/fa'
import Footer from '../Footer/Footer'

const Page = styled.main`
  min-height: 100vh;
  padding: calc(var(--header-h) + 26px) 16px 80px;
  background:
    radial-gradient(circle at 82% 0%, rgba(125, 92, 232, 0.13), transparent 28rem),
    var(--bg);
`

const Shell = styled.div`
  width: min(100%, 940px);
  margin: 0 auto;
`

const Header = styled.header`
  padding: clamp(22px, 4vw, 42px);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: linear-gradient(130deg, color-mix(in srgb, var(--bg-card) 95%, transparent), color-mix(in srgb, var(--bg-elevated) 82%, transparent));

  h1 { margin: 20px 0 10px; color: var(--text-primary); font-size: clamp(30px, 5vw, 48px); letter-spacing: -0.06em; line-height: 1; }
  p { max-width: 66ch; margin: 0; color: var(--text-secondary); font-size: 13px; line-height: 1.65; }
`

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 750;
  text-decoration: none;
  &:hover { color: var(--accent); }
`

const Eyebrow = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--accent);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  svg { color: var(--accent); }
`

const Revision = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
  color: var(--text-muted);
  font-size: 11px;
  span { display: inline-flex; min-height: 24px; align-items: center; padding: 0 8px; border: 1px solid var(--border); border-radius: var(--radius-full); background: var(--bg); }
`

const Body = styled.div`
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
  margin-top: 18px;

  @media (max-width: 760px) { grid-template-columns: 1fr; }
`

const Contents = styled.nav`
  position: sticky;
  top: calc(var(--header-h) + 16px);
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  @media (max-width: 760px) { position: static; }
  h2 { margin: 0 0 10px; color: var(--text-primary); font-size: 12px; }
  a { display: block; padding: 5px 0; color: var(--text-secondary); font-size: 11px; text-decoration: none; }
  a:hover { color: var(--accent); }
`

const Article = styled.article`
  padding: clamp(20px, 4vw, 38px);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.75;

  h2 { margin: 30px 0 8px; color: var(--text-primary); font-size: 20px; letter-spacing: -0.025em; scroll-margin-top: 80px; }
  h2:first-child { margin-top: 0; }
  h3 { margin: 22px 0 7px; color: var(--text-primary); font-size: 15px; }
  p { margin: 10px 0; }
  ul, ol { margin: 10px 0; padding-left: 22px; }
  li { margin: 5px 0; }
  strong { color: var(--text-primary); }
  a { color: var(--accent); }
  code { padding: 2px 5px; border-radius: 4px; background: var(--bg-elevated); color: var(--accent); font-size: 0.92em; }
`

const Callout = styled.aside`
  display: flex;
  gap: 10px;
  margin: 0 0 24px;
  padding: 13px 14px;
  border: 1px solid color-mix(in srgb, var(--accent) 32%, var(--border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 8%, var(--bg));
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.55;
  svg { flex: 0 0 auto; margin-top: 2px; color: var(--accent); }
`

const Support = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
  a { display: inline-flex; min-height: 34px; align-items: center; gap: 7px; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; color: var(--text-secondary); font-size: 11px; font-weight: 750; text-decoration: none; }
  a:hover { border-color: var(--accent); color: var(--text-primary); }
`

const LegalPage = ({ title, eyebrow = 'Trust & transparency', revision = 'August 13, 2026', intro, sections = [], children }) => (
  <>
    <Page>
      <Shell>
        <Header>
          <Eyebrow><FaShieldAlt size={10} /> {eyebrow}</Eyebrow>
          <BackLink to="/home"><FaArrowLeft size={11} /> Back to Aniraku</BackLink>
          <h1>{title}</h1>
          <p>{intro}</p>
          <Revision><span>{revision}</span><span>Plain-language working draft</span><span>Open-source project</span></Revision>
        </Header>
        <Body>
          <Contents aria-label="Page contents">
            <h2>On this page</h2>
            {sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}
          </Contents>
          <Article>
            <Callout><FaShieldAlt size={14} /> <span>Aniraku is an open-source client and community service. We aim to describe what the product actually does, what third parties control, and how users can ask for help or removal.</span></Callout>
            {children}
            <Support>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/dmca">DMCA & content reports</Link>
              <Link to="/license">AGPL-3.0 license</Link>
              <a href="https://github.com/Aniraku/Aniraku/issues" target="_blank" rel="noreferrer"><FaGithub size={12} /> Report a product issue</a>
              <a href="https://github.com/Aniraku/Aniraku" target="_blank" rel="noreferrer"><FaExternalLinkAlt size={10} /> Source repository</a>
            </Support>
          </Article>
        </Body>
      </Shell>
    </Page>
    <Footer />
  </>
)

export default LegalPage
