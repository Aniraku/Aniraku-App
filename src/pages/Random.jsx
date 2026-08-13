import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaInfoCircle, FaPlay, FaRandom, FaRedo, FaStar } from 'react-icons/fa'
import { anilistQuery, BROWSE_QUERY } from '../lib/anilist'
import { filterAdult, useNsfw } from '../hooks/useNsfw'
import Footer from '../components/Footer/Footer'
import { generateSlug } from '../lib/slug'
import styled from 'styled-components'

const MODES = [
  { id: 'any', label: 'ANY', sort: 'POPULARITY_DESC' },
  { id: 'action', label: 'ACTION', genre: 'Action', sort: 'TRENDING_DESC' },
  { id: 'movie', label: 'MOVIE', format: 'MOVIE', sort: 'SCORE_DESC' },
]

const titleOf = (anime) => anime?.title?.english || anime?.title?.romaji || anime?.title?.userPreferred || 'Untitled title'
const textOf = (value = '') => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const detailHref = (anime) => `/anime/${generateSlug(titleOf(anime))}-${anime.id}`
const watchHref = (anime) => `/watch/${generateSlug(titleOf(anime))}-${anime.id}-episode-1`
const formatOf = (value) => (value || 'ANIME').replace(/_/g, ' ')

const Page = styled.main`
  min-height: 100vh;
  background:
    radial-gradient(circle at 88% 2%, rgba(255, 255, 255, 0.06), transparent 25rem),
    var(--bg);
  color: var(--text-primary);
`

const Frame = styled.div`
  width: min(960px, calc(100% - 32px));
  margin: 0 auto;
  padding: clamp(28px, 6vw, 74px) 0 52px;

  @media (max-width: 480px) { width: min(100% - 24px, 960px); }
`

const Mono = styled.span`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: 0.09em;
  text-transform: uppercase;
`

const SystemBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 13px;
  border-bottom: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 10px;

  .signal { display: inline-flex; align-items: center; gap: 7px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); }
`

const Heading = styled.section`
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  padding: clamp(28px, 6vw, 62px) 0 clamp(22px, 4vw, 36px);

  h1 {
    max-width: 650px;
    margin: 0;
    font-size: clamp(38px, 7vw, 80px);
    font-weight: 850;
    letter-spacing: -0.07em;
    line-height: 0.86;
  }

  p { max-width: 220px; margin: 0 0 4px; color: var(--text-muted); font-size: 12px; line-height: 1.55; }

  @media (max-width: 600px) {
    display: block;
    h1 { font-size: clamp(42px, 14vw, 64px); }
    p { margin-top: 18px; }
  }
`

const Controls = styled.section`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 12px;

  @media (max-width: 570px) { align-items: stretch; flex-direction: column; }
`

const ModeGroup = styled.div`
  display: inline-grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
`

const Mode = styled.button`
  min-width: 86px;
  min-height: 38px;
  border: 0;
  border-right: 1px solid var(--border);
  background: ${({ $active }) => ($active ? 'var(--text-primary)' : 'transparent')};
  color: ${({ $active }) => ($active ? 'var(--bg)' : 'var(--text-muted)')};
  cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.09em;
  transition: background 160ms ease, color 160ms ease;

  &:last-child { border-right: 0; }
  &:hover { color: ${({ $active }) => ($active ? 'var(--bg)' : 'var(--text-primary)')}; }
  &:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
`

const Roll = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 39px;
  padding: 10px 13px;
  border: 1px solid var(--accent);
  border-radius: 10px;
  background: var(--accent);
  color: #090909;
  cursor: pointer;
  font-size: 12px;
  font-weight: 850;
  transition: transform 150ms var(--ease-out, ease-out), filter 150ms ease;

  &:hover { filter: brightness(1.06); }
  &:active { transform: scale(0.97); }
  &:disabled { cursor: wait; opacity: 0.62; }
  &:focus-visible { outline: 2px solid var(--text-primary); outline-offset: 3px; }
`

const Panel = styled.section`
  position: relative;
  display: grid;
  grid-template-columns: minmax(190px, 0.34fr) minmax(0, 0.66fr);
  min-height: 410px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--bg-card);

  @media (max-width: 650px) {
    grid-template-columns: 122px minmax(0, 1fr);
    min-height: 360px;
    border-radius: 13px;
  }
`

const Poster = styled(Link)`
  position: relative;
  min-height: 100%;
  overflow: hidden;
  background: #15161a;

  &::after {
    position: absolute;
    inset: auto 0 0;
    height: 38%;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.66));
    content: '';
  }

  &:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
`

const PosterImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 260ms var(--ease-out, ease-out);
  ${Poster}:hover & { transform: scale(1.035); }
`

const Content = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  padding: clamp(20px, 4vw, 38px);

  @media (max-width: 650px) { padding: 18px; }
`

const PickLabel = styled(Mono)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 10px;

  b { color: var(--accent); font-weight: 900; }
`

const Title = styled.h2`
  margin: 18px 0 0;
  font-size: clamp(26px, 4vw, 48px);
  font-weight: 800;
  letter-spacing: -0.055em;
  line-height: 0.98;
  text-wrap: balance;
`

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 15px;
  color: var(--text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;

  span { display: inline-flex; align-items: center; gap: 5px; }
  span + span::before { color: var(--border-hover); content: '/'; }
  svg { color: var(--accent); }
`

const Description = styled.p`
  display: -webkit-box;
  max-width: 570px;
  margin: 20px 0 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.68;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;

  @media (max-width: 650px) { -webkit-line-clamp: 4; font-size: 12px; }
`

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 24px;
`

const Action = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 10px 13px;
  border: 1px solid var(--text-primary);
  border-radius: 9px;
  background: var(--text-primary);
  color: var(--bg);
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
  transition: transform 150ms var(--ease-out, ease-out), filter 150ms ease;

  &:hover { filter: brightness(0.9); }
  &:active { transform: scale(0.97); }
  &:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
`

const Detail = styled(Action)`
  border-color: var(--border-hover);
  background: transparent;
  color: var(--text-primary);

  &:hover { border-color: var(--text-primary); background: rgba(255, 255, 255, 0.06); filter: none; }
`

const Loader = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  background: rgba(10, 11, 13, 0.6);
  backdrop-filter: blur(3px);

  span { display: inline-flex; align-items: center; gap: 9px; padding: 9px 11px; border: 1px solid var(--border-hover); border-radius: 999px; background: var(--bg); color: var(--text-primary); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; letter-spacing: 0.07em; }
  svg { color: var(--accent); animation: spin 800ms linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`

const Blank = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 26px;
  text-align: center;

  h2 { margin: 13px 0 7px; font-size: 24px; letter-spacing: -0.04em; }
  p { max-width: 360px; margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.6; }
`

const FooterLine = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;
  color: var(--text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.05em;
  text-transform: uppercase;

  @media (max-width: 520px) { flex-direction: column; gap: 5px; }
`

export default function Random() {
  const { nsfwEnabled } = useNsfw()
  const [modeId, setModeId] = useState('any')
  const [anime, setAnime] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)
  const previousId = useRef(null)
  const initialised = useRef(false)
  const activeMode = MODES.find((mode) => mode.id === modeId) || MODES[0]

  const findPick = useCallback(async (mode = activeMode) => {
    const id = ++requestId.current
    setLoading(true)
    setError('')

    try {
      const variables = {
        page: Math.floor(Math.random() * 14) + 1,
        perPage: 24,
        sort: [mode.sort],
      }
      if (mode.genre) variables.genre = mode.genre
      if (mode.format) variables.format = mode.format

      const { data } = await anilistQuery(BROWSE_QUERY, variables)
      if (id !== requestId.current) return

      const candidates = filterAdult(data?.Page?.media || [], nsfwEnabled)
      const fresh = candidates.filter((item) => item.id !== previousId.current)
      const pool = fresh.length ? fresh : candidates
      if (!pool.length) throw new Error('No candidates')

      const next = pool[Math.floor(Math.random() * pool.length)]
      previousId.current = next.id
      setAnime(next)
    } catch {
      if (id === requestId.current) setError('No signal right now. Try one more time.')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [activeMode, nsfwEnabled])

  useEffect(() => {
    if (initialised.current) return
    initialised.current = true
    findPick(MODES[0])
  }, [findPick])

  const pickMode = (mode) => {
    setModeId(mode.id)
    findPick(mode)
  }

  const image = anime?.coverImage?.extraLarge || anime?.coverImage?.large || anime?.coverImage?.medium || ''
  const description = textOf(anime?.description) || 'Open the title to see its full synopsis, release information, and available episodes.'

  return (
    <Page id="main">
      <Frame>
        <SystemBar>
          <Mono className="signal"><i className="dot" /> Random discovery</Mono>
          <Mono>{nsfwEnabled ? 'Expanded mode' : 'Safe mode'}</Mono>
        </SystemBar>

        <Heading>
          <h1>WHAT<br />NEXT?</h1>
          <p>One title. One decision. Roll again whenever the signal is not right.</p>
        </Heading>

        <Controls>
          <ModeGroup aria-label="Random discovery mode">
            {MODES.map((mode) => <Mode key={mode.id} type="button" $active={mode.id === modeId} onClick={() => pickMode(mode)} aria-pressed={mode.id === modeId}>{mode.label}</Mode>)}
          </ModeGroup>
          <Roll type="button" onClick={() => findPick()} disabled={loading}><FaRandom size={12} /> New pick</Roll>
        </Controls>

        <Panel aria-live="polite" aria-busy={loading}>
          {anime && (
            <>
              <Poster to={detailHref(anime)} aria-label={`Open ${titleOf(anime)} details`}>
                {image && <PosterImage src={image} alt={titleOf(anime)} />}
              </Poster>
              <Content>
                <div>
                  <PickLabel><b>●</b> Pick / {activeMode.label}</PickLabel>
                  <Title>{titleOf(anime)}</Title>
                  <Meta>
                    {anime.averageScore && <span><FaStar size={10} /> {anime.averageScore}%</span>}
                    <span>{formatOf(anime.format)}</span>
                    {anime.episodes && <span>{anime.episodes} {anime.episodes === 1 ? 'EP' : 'EPS'}</span>}
                    {anime.seasonYear && <span>{anime.seasonYear}</span>}
                  </Meta>
                  <Description>{description}</Description>
                </div>
                <Actions>
                  <Action to={watchHref(anime)}><FaPlay size={11} /> Watch</Action>
                  <Detail to={detailHref(anime)}><FaInfoCircle size={12} /> Details</Detail>
                </Actions>
              </Content>
            </>
          )}

          {!anime && !loading && (
            <Blank>
              <div>
                <FaRandom size={28} style={{ color: 'var(--accent)' }} />
                <h2>{error ? 'No result yet.' : 'Finding a title.'}</h2>
                <p>{error || 'The next recommendation is being selected.'}</p>
                {error && <Roll type="button" style={{ marginTop: 18 }} onClick={() => findPick()}><FaRedo size={11} /> Try again</Roll>}
              </div>
            </Blank>
          )}

          {loading && <Loader><span><FaRedo size={11} /> TUNING SIGNAL</span></Loader>}
        </Panel>

        <FooterLine>
          <span><Mono>Mode // {activeMode.label}</Mono></span>
          <span><Mono>{anime ? 'Open details or continue watching' : 'Loading selection'}</Mono></span>
        </FooterLine>
      </Frame>
      <Footer />
      <div className="bottom-nav-spacer" />
    </Page>
  )
}
