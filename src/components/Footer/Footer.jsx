import React from 'react'
import { F } from './footer.style'
import { Link } from 'react-router-dom'
import Logo from '../Logo'
import { FaGithub, FaDiscord } from 'react-icons/fa'

const letters = [
  'All', '#', '0-9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
]

const browseLinks = [
  { label: 'Home', to: '/home' },
  { label: 'Catalog', to: '/catalog' },
  { label: 'Schedule', to: '/schedule' },
  { label: 'Most Popular', to: '/catalog?sort=POPULARITY_DESC' },
  { label: 'Top Airing', to: '/catalog?status=RELEASING' },
  { label: 'Top Rated', to: '/catalog?sort=SCORE_DESC' },
  { label: 'Anime Movies', to: '/catalog?format=MOVIE' },
  { label: 'TV Series', to: '/catalog?format=TV' },
]

const popularGenres = [
  { label: 'Action', to: '/catalog?genre=Action' },
  { label: 'Romance', to: '/catalog?genre=Romance' },
  { label: 'Comedy', to: '/catalog?genre=Comedy' },
  { label: 'Fantasy', to: '/catalog?genre=Fantasy' },
  { label: 'Sci-Fi', to: '/catalog?genre=Sci-Fi' },
  { label: 'Horror', to: '/catalog?genre=Horror' },
  { label: 'Slice of Life', to: '/catalog?genre=Slice%20of%20Life' },
  { label: 'Sports', to: '/catalog?genre=Sports' },
  { label: 'Supernatural', to: '/catalog?genre=Supernatural' },
  { label: 'Mystery', to: '/catalog?genre=Mystery' },
  { label: 'Drama', to: '/catalog?genre=Drama' },
  { label: 'Adventure', to: '/catalog?genre=Adventure' },
]

const resourceLinks = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'DMCA', to: '/dmca' },
  { label: 'AGPL License', to: '/license' },
  { label: 'Community Guidelines', to: '/community-guidelines' },
]

const Footer = () => {
  return (
    <F.Footer id="footer">
      {/* Desktop grid */}
      <F.DesktopGrid>
        <F.Col>
          <Logo to="/home" height={36} showText />
          <F.Disclaimer>
            Aniraku is an open-source media client. We do not host, store, or upload video files.
            Stream links are resolved from publicly available third-party sources at playback time.
          </F.Disclaimer>
          <F.Socials>
            <F.SocialLink href="https://github.com/Aniraku/Aniraku" target="_blank" rel="noreferrer" aria-label="GitHub"><FaGithub size={18} /></F.SocialLink>
            <F.SocialLink href="https://discord.gg/aniraku" target="_blank" rel="noreferrer" aria-label="Discord"><FaDiscord size={18} /></F.SocialLink>
          </F.Socials>
          <F.TrustLine>
            {resourceLinks.map((resource, index) => <React.Fragment key={resource.to}><Link to={resource.to}>{resource.label}</Link>{index < resourceLinks.length - 1 && <span>·</span>}</React.Fragment>)}
            <span>·</span><a href="https://github.com/Aniraku/Aniraku/issues" target="_blank" rel="noreferrer">Report an issue</a>
          </F.TrustLine>
        </F.Col>

        <F.Col>
          <F.ColTitle>Browse</F.ColTitle>
          <F.ColLinks>
            {browseLinks.map(l => (
              <F.LinkItem key={l.to} as={Link} to={l.to}>{l.label}</F.LinkItem>
            ))}
          </F.ColLinks>
        </F.Col>

        <F.Col>
          <F.ColTitle>Genres</F.ColTitle>
          <F.ColLinks>
            {popularGenres.map(l => (
              <F.LinkItem key={l.to} as={Link} to={l.to}>{l.label}</F.LinkItem>
            ))}
          </F.ColLinks>
        </F.Col>

        <F.Col>
          <F.ColTitle>A-Z List</F.ColTitle>
          <F.AzGrid>
            {letters.map((item, idx) => (
              <F.AzLink
                key={idx}
                as={Link}
                to={item === 'All' ? '/catalog' : `/catalog?search=${encodeURIComponent(item)}`}
              >
                {item}
              </F.AzLink>
            ))}
          </F.AzGrid>
        </F.Col>
      </F.DesktopGrid>

      {/* Mobile layout */}
      <F.MobileFooter>
        <F.MobileTop>
          <Logo to="/home" height={28} showText />
          <F.Socials>
            <F.SocialLink href="https://github.com/Aniraku/Aniraku" target="_blank" rel="noreferrer" aria-label="GitHub"><FaGithub size={16} /></F.SocialLink>
            <F.SocialLink href="https://discord.gg/aniraku" target="_blank" rel="noreferrer" aria-label="Discord"><FaDiscord size={16} /></F.SocialLink>
          </F.Socials>
        </F.MobileTop>
        <F.MobileLinks>
          {resourceLinks.map((resource, index) => <React.Fragment key={resource.to}><F.MobileLink as={Link} to={resource.to}>{resource.label}</F.MobileLink>{index < resourceLinks.length - 1 && <F.MobileDot>·</F.MobileDot>}</React.Fragment>)}
          <F.MobileDot>·</F.MobileDot>
          <F.MobileLink as="a" href="https://github.com/Aniraku/Aniraku/issues" target="_blank" rel="noreferrer">Report an issue</F.MobileLink>
        </F.MobileLinks>
        <F.Copyright>&copy; 2026 Aniraku · AGPL-3.0 · No media hosting</F.Copyright>
      </F.MobileFooter>

      <F.Bottom>
        <F.Copyright>&copy; 2026 Aniraku Contributors · AGPL-3.0 · Not affiliated with AniList or any studio</F.Copyright>
      </F.Bottom>
    </F.Footer>
  )
}

export default Footer
