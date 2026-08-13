import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { M } from './main.style'
import { FaRocket, FaList, FaBookOpen, FaDesktop, FaUsers, FaGlobe, FaUserShield } from 'react-icons/fa'
import { useTrendingAnime } from '../hooks/useAnime'
import { generateSlug } from '../lib/slug'

const features1 = [
  { icon: FaRocket, title: 'Quick Sessions', desc: 'Jump into anime fast with instant playback and minimal buffering.' },
  { icon: FaList, title: 'Binge-Friendly', desc: 'Auto-play next episode, progress tracking, and watch history.' },
  { icon: FaBookOpen, title: 'Deep Dive', desc: 'Detailed info, recommendations, and community comments.' },
]

const features2 = [
  { icon: FaDesktop, title: 'HD Quality', desc: 'Stream in up to 1080p with adaptive bitrate streaming.' },
  { icon: FaGlobe, title: 'Cross-Platform', desc: 'Works on desktop, tablet, and mobile browsers.' },
  { icon: FaUserShield, title: 'No Account Required', desc: 'Start watching immediately, optional account for extras.' },
]

const testimonials = [
  { name: 'SakuraTanuki', handle: '@sakura_tanuki', text: 'Finally, an anime site that doesn\'t bombard me with ads. Clean UI and fast streaming.' },
  { name: 'HoshiNeko', handle: '@hoshi_neko', text: 'The Watch2gether feature is amazing for watching with friends across different time zones.' },
  { name: 'KazeOni', handle: '@kaze_oni', text: 'Love the progress tracking. I can pick up exactly where I left off on any device.' },
  { name: 'YukiKitsune', handle: '@yuki_kitsune', text: 'The catalog filtering is top-notch. Finding specific anime has never been easier.' },
  { name: 'SoraRyu', handle: '@sora_ryu', text: 'Open source and community-driven. This is how anime streaming should be.' },
  { name: 'MizuTengu', handle: '@mizu_tengu', text: 'The quality selector and subtitle options are better than most premium services.' },
]

const Main = () => {
  const navigate = useNavigate()
  const { data } = useTrendingAnime()
  const trending = Array.isArray(data) ? data.slice(0, 8) : []
  const col1 = trending.filter((_, i) => i % 2 === 0)
  const col2 = trending.filter((_, i) => i % 2 === 1)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <M.Page>
      {/* Video Intro */}
      <M.VideoSection>
        <M.Video
          src="https://animex.one/misc/intro.webm"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
        <M.VideoOverlay />
        <M.VideoContent>
          <M.VideoSubtitle>Stream, Discover & Download your favorite anime</M.VideoSubtitle>
          <M.CTA>
            <M.CTAPrimary to="/home">Browse</M.CTAPrimary>
            <M.CTAGhost to="/dmca">DMCA</M.CTAGhost>
          </M.CTA>
        </M.VideoContent>
      </M.VideoSection>

      {/* 3D Card Carousel */}
      <M.CarouselSection>
        <M.CarouselInner>
          <M.CarouselText>
            <h2>Stream, Discover & Download</h2>
            <p>
              Explore a vast library of anime with detailed information, episodes, and community features.
              Your next favorite anime is just a click away.
            </p>
            <Link to="/home" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'var(--accent)',
              color: '#000',
              borderRadius: 'var(--radius-full)',
              fontWeight: 700,
              fontSize: '14px',
              textDecoration: 'none',
              transition: 'transform 0.2s',
            }}>
              Start Watching
            </Link>
          </M.CarouselText>

          <M.CarouselCards>
            <div style={{ display: 'flex', gap: '12px' }}>
              <M.CardColumn style={{ transform: `rotateY(-12deg) translateX(${scrollY * 0.05}px)` }}>
                {col1.map((anime, idx) => {
                  const t = anime.title?.english || anime.title?.romaji || 'Unknown'
                  return (
                    <M.CarouselCard to={`/anime/${generateSlug(t)}-${anime.id}`} key={anime.id || idx}>
                      <M.CarouselCardImg src={anime.coverImage?.medium || anime.coverImage?.large || ''} alt="" />
                      <M.CarouselCardInfo>
                        <M.CarouselCardTitle>{t}</M.CarouselCardTitle>
                        <M.CarouselCardMeta>{anime.format || 'TV'} · {anime.episodes || '?'} eps</M.CarouselCardMeta>
                      </M.CarouselCardInfo>
                    </M.CarouselCard>
                  )
                })}
              </M.CardColumn>

              <M.CardColumn style={{ transform: `rotateY(-12deg) translateX(${-scrollY * 0.05}px)` }}>
                {col2.map((anime, idx) => {
                  const t = anime.title?.english || anime.title?.romaji || 'Unknown'
                  return (
                    <M.CarouselCard to={`/anime/${generateSlug(t)}-${anime.id}`} key={anime.id || idx}>
                      <M.CarouselCardImg src={anime.coverImage?.medium || anime.coverImage?.large || ''} alt="" />
                      <M.CarouselCardInfo>
                        <M.CarouselCardTitle>{t}</M.CarouselCardTitle>
                        <M.CarouselCardMeta>{anime.format || 'TV'} · {anime.episodes || '?'} eps</M.CarouselCardMeta>
                      </M.CarouselCardInfo>
                    </M.CarouselCard>
                  )
                })}
              </M.CardColumn>
            </div>
          </M.CarouselCards>
        </M.CarouselInner>
      </M.CarouselSection>

      {/* Feature Section 1 */}
      <M.Section>
        <M.Glow style={{ top: '20%', left: '-10%' }} />
        <M.SectionInner>
          <M.Divider />
          <M.SectionTitle>Watch Anime Your Way</M.SectionTitle>
          <M.FeatureGrid3>
            {features1.map(({ icon: Icon, title, desc }, idx) => (
              <M.FeatureCard key={idx}>
                <M.FeatureIcon><Icon size={24} /></M.FeatureIcon>
                <M.FeatureTitle>{title}</M.FeatureTitle>
                <M.FeatureDesc>{desc}</M.FeatureDesc>
              </M.FeatureCard>
            ))}
          </M.FeatureGrid3>
        </M.SectionInner>
      </M.Section>

      {/* Feature Section 2 */}
      <M.Section>
        <M.Glow style={{ bottom: '10%', right: '-10%' }} />
        <M.SectionInner>
          <M.Divider />
          <M.SectionTitle>Fast, Reliable Streaming</M.SectionTitle>
          <M.FeatureGrid4>
            {features2.map(({ icon: Icon, title, desc }, idx) => (
              <M.FeatureCard key={idx}>
                <M.FeatureIcon><Icon size={24} /></M.FeatureIcon>
                <M.FeatureTitle>{title}</M.FeatureTitle>
                <M.FeatureDesc>{desc}</M.FeatureDesc>
              </M.FeatureCard>
            ))}
          </M.FeatureGrid4>
        </M.SectionInner>
      </M.Section>

      {/* Footer */}
      <M.Footer>
        <M.FooterText>© 2026 Aniraku · AGPL-3.0 · Does not host media</M.FooterText>
        <M.FooterLinks>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/dmca">DMCA</Link>
          <a href="https://github.com/Aniraku/Aniraku" target="_blank" rel="noreferrer">GitHub</a>
        </M.FooterLinks>
      </M.Footer>
    </M.Page>
  )
}

export default Main
