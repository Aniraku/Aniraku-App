import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { FaArrowRight, FaCalendarAlt, FaClock, FaSearch, FaTimes, FaTv } from 'react-icons/fa'
import { anilistQuery, BROWSE_QUERY } from '../lib/anilist'
import { filterAdult, useNsfw, useStreamable } from '../hooks/useNsfw'
import Footer from '../components/Footer/Footer'
import TrustStrip from '../components/TrustStrip'
import { setScheduleSEO } from '../lib/seo'
import { generateSlug } from '../lib/slug'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const Page = styled.main`
  min-height: 100vh;
  padding-top: var(--header-h);
  background:
    radial-gradient(circle at 82% 7%, rgba(139,92,246,0.12), transparent 26%),
    var(--bg);
`

const Container = styled.div`
  width: min(100%, 1440px);
  margin: 0 auto;
  padding: clamp(26px, 4vw, 52px) clamp(14px, 3vw, 48px) 88px;

  @media (max-width: 640px) { padding: 24px 12px 76px; }
`

const Hero = styled.header`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  align-items: end;
  margin-bottom: 22px;

  @media (max-width: 680px) { grid-template-columns: 1fr; align-items: start; gap: 14px; }
`

const HeroCopy = styled.div`
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    color: var(--accent);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }
  h1 { margin: 0; color: var(--text-primary); font-size: clamp(30px, 4vw, 48px); letter-spacing: -0.05em; line-height: 1; }
  p { max-width: 58ch; margin: 12px 0 0; color: var(--text-secondary); font-size: 14px; line-height: 1.58; }
`

const HeroAside = styled.div`
  display: grid;
  justify-items: end;
  gap: 8px;
  @media (max-width: 680px) { justify-items: start; }
`

const ScheduleNote = styled.div`
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 9px;
  padding: 0 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
  svg { color: var(--accent); }
  @media (max-width: 680px) { width: fit-content; }
`

const NextUp = styled(Link)`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  min-width: min(100%, 245px);
  padding: 9px 11px;
  border: 1px solid color-mix(in srgb, var(--accent) 52%, var(--border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-card));
  color: inherit;
  text-decoration: none;
  transition: transform var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
  svg { grid-row: span 2; align-self: center; color: var(--accent); }
  small { color: var(--text-muted); font-size: 9px; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; }
  strong { overflow: hidden; color: var(--text-primary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
  &:hover { transform: translateY(-1px); border-color: var(--accent); background: color-mix(in srgb, var(--accent) 13%, var(--bg-card)); }
  &:active { transform: scale(0.98); }
`

const ControlPanel = styled.section`
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
`

const ControlsTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 9px;

  p { margin: 0; color: var(--text-muted); font-size: 11px; font-weight: 650; }
`

const TodayButton = styled.button`
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--bg-card);
  color: var(--text-secondary);
  font: inherit;
  font-size: 11px;
  font-weight: 750;
  cursor: pointer;
  transition: transform var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
  svg { color: var(--accent); }
  &:hover { border-color: var(--accent); color: var(--text-primary); }
  &:active { transform: scale(0.96); }
`

const SearchBox = styled.div`
  display: flex;
  min-height: 45px;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--bg-card);
  transition: border-color var(--transition-fast), background var(--transition-fast);

  &:focus-within { border-color: var(--accent); background: var(--bg-elevated); }
  svg { color: var(--text-muted); }
  input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text-primary); font: inherit; font-size: 14px; }
  input::placeholder { color: var(--text-muted); }
`

const ClearSearch = styled.button`
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  color: var(--text-secondary);
  &:hover { background: var(--bg-secondary); color: var(--text-primary); }
  &:active { transform: scale(0.96); }
`

const DaysRow = styled.nav`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  margin-top: 12px;
  padding: 2px 1px 4px;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`

const DayTab = styled.button`
  display: grid;
  min-width: 66px;
  min-height: 58px;
  flex: 0 0 auto;
  place-items: center;
  gap: 1px;
  padding: 7px 12px;
  border: 1px solid ${({ $active }) => ($active ? 'var(--accent)' : 'var(--border)')};
  border-radius: 10px;
  background: ${({ $active }) => ($active ? 'var(--accent)' : 'var(--bg-card)')};
  color: ${({ $active }) => ($active ? 'var(--bg)' : 'var(--text-secondary)')};
  font: inherit;
  cursor: pointer;
  transition: transform var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);

  strong { font-size: 12px; font-weight: 800; }
  span { font-size: 10px; font-weight: 700; opacity: 0.72; }
  em { color: inherit; font-size: 8px; font-style: normal; font-weight: 850; letter-spacing: 0.06em; opacity: 0.72; text-transform: uppercase; }
  &:hover { border-color: var(--accent); }
  &:active { transform: scale(0.96); }

  @media (max-width: 640px) { min-width: 61px; min-height: 54px; padding: 6px 10px; }
`

const ScheduleSummary = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 28px 0 15px;

  h2 { margin: 0; color: var(--text-primary); font-size: clamp(20px, 2.5vw, 28px); letter-spacing: -0.04em; }
  p { margin: 5px 0 0; color: var(--text-secondary); font-size: 13px; }
`

const Count = styled.span`
  flex: 0 0 auto;
  padding: 8px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 750;
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 780px) { grid-template-columns: 1fr; }
`

const AiringCard = styled(Link)`
  position: relative;
  display: grid;
  grid-template-columns: 66px minmax(0, 1fr) auto;
  gap: 14px;
  min-height: 96px;
  align-items: center;
  padding: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: inherit;
  text-decoration: none;
  transition: transform var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);

  &:hover { transform: translateY(-2px); border-color: var(--border-hover); background: var(--bg-elevated); box-shadow: var(--shadow-sm); }
  &:active { transform: scale(0.99); }
  &:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

  @media (max-width: 440px) { grid-template-columns: 58px minmax(0, 1fr); gap: 11px; }
`

const Poster = styled.div`
  width: 66px;
  height: 76px;
  overflow: hidden;
  border-radius: 7px;
  background: var(--bg-elevated);
  img { display: block; width: 100%; height: 100%; object-fit: cover; }
  @media (max-width: 440px) { width: 58px; height: 72px; }
`

const AiringInfo = styled.div`
  min-width: 0;
  h3 { margin: 0; overflow: hidden; color: var(--text-primary); font-size: 14px; font-weight: 760; letter-spacing: -0.015em; text-overflow: ellipsis; white-space: nowrap; }
  p { margin: 6px 0 0; color: var(--text-secondary); font-size: 12px; }
  .episode { color: var(--accent); font-weight: 750; }
  .relative { margin-top: 4px; color: var(--text-muted); font-size: 10px; font-weight: 700; }
`

const TimeBox = styled.div`
  display: grid;
  min-width: 72px;
  justify-items: end;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  svg { color: var(--accent); }
  strong { color: var(--text-primary); font-size: 13px; }
  @media (max-width: 440px) { display: none; }
`

const MobileTime = styled.p`
  display: none;
  @media (max-width: 440px) { display: block; }
`

const EmptyState = styled.div`
  display: grid;
  min-height: 280px;
  place-items: center;
  padding: 28px;
  border: 1px dashed var(--border-hover);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  text-align: center;

  svg { margin-bottom: 12px; color: var(--accent); }
  h2 { margin: 0; color: var(--text-primary); font-size: 18px; }
  p { margin: 8px 0 0; font-size: 13px; }
  button { margin-top: 16px; min-height: 38px; padding: 0 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); color: var(--text-primary); font: inherit; font-size: 12px; font-weight: 750; }
`

const SkeletonCard = styled.div`
  min-height: 96px;
  border-radius: var(--radius-md);
  background: linear-gradient(110deg, var(--bg-card) 28%, var(--bg-elevated) 40%, var(--bg-card) 52%);
  background-size: 220% 100%;
  animation: scheduleShimmer 1.35s linear infinite;

  @keyframes scheduleShimmer { to { background-position: -220% 0; } }
`

const dayNameFor = (timestamp) => DAYS[new Date(timestamp * 1000).getDay() === 0 ? 6 : new Date(timestamp * 1000).getDay() - 1]

const Schedule = () => {
  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
  const [activeDay, setActiveDay] = useState(DAYS[todayIndex])
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isLoading, error, refetch } = useQuery(['schedule'], async () => {
    const variables = { page: 1, perPage: 100, status: 'RELEASING', sort: ['POPULARITY_DESC'] }
    const { data: response } = await anilistQuery(BROWSE_QUERY, variables)
    return (response?.Page?.media || [])
      .filter((media) => media.nextAiringEpisode?.airingAt)
      .map((media) => ({
        id: media.id,
        title: media.title,
        coverImage: media.coverImage,
        format: media.format,
        episode: media.nextAiringEpisode.episode,
        airingAt: media.nextAiringEpisode.airingAt,
        day: dayNameFor(media.nextAiringEpisode.airingAt),
      }))
      .sort((a, b) => a.airingAt - b.airingAt)
  }, { staleTime: 30 * 60 * 1000 })

  useEffect(() => {
    const timeout = setTimeout(() => setSearchQuery(searchInput.trim()), 260)
    return () => clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => { setScheduleSEO() }, [])

  const dayOptions = useMemo(() => {
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(weekStart.getDate() - todayIndex)
    return DAYS.map((day, index) => {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + index)
      return {
        day,
        label: day.slice(0, 3),
        date: date.toLocaleDateString([], { day: 'numeric' }),
        fullDate: date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }),
        isToday: index === todayIndex,
      }
    })
  }, [todayIndex])

  const { nsfwEnabled } = useNsfw()
  const streamed = useStreamable(filterAdult(Array.isArray(data) ? data : [], nsfwEnabled))
  const dayItems = streamed.filter((item) => {
    if (item.day !== activeDay) return false
    const title = (item.title?.english || item.title?.romaji || item.title?.userPreferred || '').toLowerCase()
    return !searchQuery || title.includes(searchQuery.toLowerCase())
  })

  const formatTime = (timestamp) => new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const relativeTime = (timestamp) => {
    const diff = timestamp * 1000 - Date.now()
    const minutes = Math.round(Math.abs(diff) / 60000)
    if (minutes < 2) return diff >= 0 ? 'Airing now' : 'Aired moments ago'
    if (minutes < 60) return diff >= 0 ? `In ${minutes} min` : `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return diff >= 0 ? `In ${hours}h` : `${hours}h ago`
    const days = Math.round(hours / 24)
    return diff >= 0 ? `In ${days}d` : `${days}d ago`
  }
  const titleFor = (item) => item.title?.english || item.title?.romaji || item.title?.userPreferred || 'Unknown title'
  const activeDate = dayOptions.find((item) => item.day === activeDay)
  const nextRelease = streamed.find((item) => item.airingAt * 1000 >= Date.now())

  return (
    <>
      <Page>
        <Container>
          <Hero>
            <HeroCopy>
              <div className="eyebrow"><FaCalendarAlt size={12} /> Weekly release planner</div>
              <h1>Never miss an episode.</h1>
              <p>See what is airing next, search the week ahead, and open any show directly when it is time to watch.</p>
            </HeroCopy>
            <HeroAside>
              <ScheduleNote><FaTv size={14} /> Times shown in your local timezone</ScheduleNote>
              {nextRelease && <NextUp to={`/anime/${generateSlug(titleFor(nextRelease))}-${nextRelease.id}`} title={`Open ${titleFor(nextRelease)}`}><FaClock size={13} /><small>Next release · {relativeTime(nextRelease.airingAt)}</small><strong>{titleFor(nextRelease)} · Ep {nextRelease.episode}</strong></NextUp>}
            </HeroAside>
          </Hero>

          <ControlPanel>
            <ControlsTop>
              <p>Browse the current calendar week, with air times converted for your device.</p>
              <TodayButton type="button" onClick={() => { setActiveDay(DAYS[todayIndex]); setSearchInput('') }}><FaCalendarAlt size={11} /> Today</TodayButton>
            </ControlsTop>
            <SearchBox>
              <FaSearch size={14} />
              <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search this week’s releases" aria-label="Search weekly anime schedule" />
              {searchInput && <ClearSearch type="button" onClick={() => setSearchInput('')} aria-label="Clear schedule search"><FaTimes size={12} /></ClearSearch>}
            </SearchBox>
            <DaysRow aria-label="Select a day of the week">
              {dayOptions.map((option) => (
                <DayTab key={option.day} type="button" $active={activeDay === option.day} aria-pressed={activeDay === option.day} onClick={() => setActiveDay(option.day)}>
                  <strong>{option.label}</strong><span>{option.date}</span>{option.isToday && <em>Today</em>}
                </DayTab>
              ))}
            </DaysRow>
          </ControlPanel>
          <TrustStrip />

          <ScheduleSummary>
            <div>
              <h2>{activeDay} releases</h2>
              <p>{activeDate?.fullDate || activeDay} · Air times are shown in your device timezone</p>
            </div>
            {!isLoading && !error && <Count>{dayItems.length} {dayItems.length === 1 ? 'release' : 'releases'}</Count>}
          </ScheduleSummary>

          {isLoading ? (
            <Grid>{Array.from({ length: 8 }, (_, index) => <SkeletonCard key={index} />)}</Grid>
          ) : error ? (
            <EmptyState>
              <div><FaCalendarAlt size={23} /><h2>The schedule could not load.</h2><p>Please check your connection and try again.</p><button type="button" onClick={() => refetch()}>Try again</button></div>
            </EmptyState>
          ) : dayItems.length === 0 ? (
            <EmptyState>
              <div><FaClock size={23} /><h2>No matching releases.</h2><p>{searchQuery ? `Nothing on ${activeDay} matches “${searchQuery}”.` : `No release time is listed for ${activeDay} right now.`}</p>{searchQuery && <button type="button" onClick={() => setSearchInput('')}>Clear search</button>}</div>
            </EmptyState>
          ) : (
            <Grid>
              {dayItems.map((item) => {
                const title = titleFor(item)
                const time = formatTime(item.airingAt)
                return (
                  <AiringCard key={item.id} to={`/anime/${generateSlug(title)}-${item.id}`} title={`Open ${title}`}>
                    <Poster>{item.coverImage?.large ? <img src={item.coverImage.large} alt="" loading="lazy" /> : null}</Poster>
                    <AiringInfo>
                      <h3>{title}</h3>
                      <p><span className="episode">Episode {item.episode}</span> · {item.format || 'TV'}</p>
                      <p className="relative">{relativeTime(item.airingAt)}</p>
                      <MobileTime><FaClock size={10} /> {time}</MobileTime>
                    </AiringInfo>
                    <TimeBox><FaClock size={12} /><strong>{time}</strong><span>View details <FaArrowRight size={9} /></span></TimeBox>
                  </AiringCard>
                )
              })}
            </Grid>
          )}
        </Container>
      </Page>
      <Footer />
      <div className="bottom-nav-spacer" />
    </>
  )
}

export default Schedule
