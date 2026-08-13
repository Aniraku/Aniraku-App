import styled from 'styled-components'
import { Link } from 'react-router-dom'

export const M = {}

M.Page = styled.div`
  min-height: 100vh;
  background: var(--bg);
  overflow-x: hidden;
`

// Video Intro Section
M.VideoSection = styled.section`
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  @media (max-width: 768px) {
    height: 85vh;
  }
`

M.VideoMask = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
`

M.Video = styled.video`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 200'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Agbalumo, cursive' font-size='180' font-weight='700' fill='white'%3EANIRAKU%3C/text%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 200'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Agbalumo, cursive' font-size='180' font-weight='700' fill='white'%3EANIRAKU%3C/text%3E%3C/svg%3E");
  mask-size: contain;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-position: center;
`

M.VideoOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.8) 100%);
  z-index: 1;
`

M.VideoContent = styled.div`
  position: relative;
  z-index: 3;
  text-align: center;
  padding: 2rem;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`

M.VideoTitle = styled.h1`
  font-family: var(--font-brand);
  font-size: clamp(3rem, 8vw, 6rem);
  color: var(--text-primary);
  margin-bottom: 1rem;
  text-shadow: 0 4px 20px rgba(0,0,0,0.5);
`

M.VideoSubtitle = styled.p`
  font-size: 1.2rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
`

M.CTA = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;

  @media (max-width: 480px) {
    flex-direction: column;
    align-items: center;
  }
`

M.CTAPrimary = styled(Link)`
  padding: 14px 32px;
  background: var(--accent);
  color: #000;
  border-radius: var(--radius-full);
  font-weight: 700;
  font-size: 1rem;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(226, 232, 240, 0.3);
  }

  @media (max-width: 480px) {
    width: 100%;
    max-width: 280px;
    text-align: center;
    padding: 12px 24px;
    font-size: 14px;
  }
`

M.CTAGhost = styled(Link)`
  padding: 14px 32px;
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.2s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  @media (max-width: 480px) {
    width: 100%;
    max-width: 280px;
    text-align: center;
    padding: 12px 24px;
    font-size: 14px;
  }
`

// 3D Card Carousel
M.CarouselSection = styled.section`
  position: relative;
  padding: 4rem 2rem;
  max-width: 1400px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 2rem 1rem;
  }
`

M.CarouselInner = styled.div`
  display: flex;
  align-items: center;
  gap: 4rem;

  @media (max-width: 1000px) {
    flex-direction: column;
    gap: 2rem;
  }
`

M.CarouselText = styled.div`
  flex: 1;
  min-width: 300px;

  h2 {
    font-size: clamp(2rem, 4vw, 3rem);
    color: var(--text-primary);
    margin-bottom: 1rem;
    line-height: 1.2;
  }

  p {
    color: var(--text-secondary);
    font-size: 1rem;
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }
`

M.CarouselCards = styled.div`
  flex: 1;
  perspective: 1000px;
  min-width: 300px;
`

M.CardColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  transform: rotateY(-12deg);
  transform-style: preserve-3d;
  transition: transform 0.3s ease;

  &:first-child {
    margin-top: -200px;
  }

  &:last-child {
    margin-top: -140px;
  }

  @media (max-width: 1000px) {
    &:first-child { margin-top: 0; }
    &:last-child { margin-top: 0; }
  }
`

M.CarouselCard = styled(Link)`
  display: flex;
  gap: 12px;
  padding: 8px;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  transition: all 0.3s ease;
  text-decoration: none;

  &:hover {
    border-color: var(--accent);
    transform: translateX(8px);
  }
`

M.CarouselCardImg = styled.img`
  width: 60px;
  height: 84px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
`

M.CarouselCardInfo = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-width: 0;
`

M.CarouselCardTitle = styled.p`
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

M.CarouselCardMeta = styled.p`
  font-size: 11px;
  color: var(--text-muted);
`

// Feature Sections
M.Section = styled.section`
  position: relative;
  padding: 5rem 2rem;
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 2.5rem 1rem;
  }
`

M.SectionInner = styled.div`
  position: relative;
  z-index: 1;
`

M.SectionTitle = styled.h2`
  font-size: clamp(1.5rem, 3vw, 2rem);
  color: var(--text-primary);
  text-align: center;
  margin-bottom: 3rem;
`

M.FeatureGrid3 = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;

  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
`

M.FeatureGrid4 = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`

M.FeatureCard = styled.div`
  padding: 2rem;
  background: #0a0a0a;
  border-radius: 10px;
  border: 1px solid var(--border);
  transition: all 0.3s ease;

  &:hover {
    border-color: var(--accent);
    transform: translateY(-4px);
  }

  @media (max-width: 768px) {
    padding: 1.25rem;
  }
`

M.FeatureIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--accent-glow);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
`

M.FeatureTitle = styled.h3`
  font-size: 1rem;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
`

M.FeatureDesc = styled.p`
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.6;
`

// Testimonials
M.TestimonialGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`

M.TestimonialCard = styled.div`
  padding: 1.5rem;
  background: #0a0a0a;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);

  @media (max-width: 768px) {
    padding: 1rem;
  }
`

M.TestimonialHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 1rem;
`

M.TestimonialAvatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--accent-glow);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
`

M.TestimonialName = styled.p`
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
`

M.TestimonialHandle = styled.p`
  font-size: 12px;
  color: var(--text-muted);
`

M.TestimonialText = styled.p`
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
`

// Footer
M.Footer = styled.footer`
  padding: 4rem 2rem 2rem;
  border-top: 1px solid var(--border);
  text-align: center;

  @media (max-width: 768px) {
    padding: 2rem 1rem 1rem;
  }
`

M.FooterText = styled.p`
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 1rem;
`

M.FooterLinks = styled.div`
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  flex-wrap: wrap;

  a {
    font-size: 13px;
    color: var(--text-secondary);
    transition: color 0.2s;

    &:hover {
      color: var(--accent);
    }
  }
`

// Glow orbs
M.Glow = styled.div`
  position: absolute;
  width: 800px;
  height: 800px;
  border-radius: 50%;
  background: var(--accent);
  filter: blur(120px);
  opacity: 0.06;
  pointer-events: none;
  z-index: 0;
`

// Divider
M.Divider = styled.div`
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--border), transparent);
  margin: 2rem 0;
`
