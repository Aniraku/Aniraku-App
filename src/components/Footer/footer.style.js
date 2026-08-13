import styled from 'styled-components'
import { Link } from 'react-router-dom'

export const F = {}

F.Footer = styled.footer`
  /* Literal fallback for WebViews that fail to resolve CSS vars at paint */
  background: #0a0a0a;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  color-scheme: dark;

  @media (min-width: 769px) {
    padding: 3rem 1.5rem 1.5rem;
    margin-top: 4rem;
  }
  @media (max-width: 768px) {
    padding: 1.25rem 1rem 5rem;
    margin-top: 0.5rem;
  }
`

/* Desktop grid — hidden on mobile */
F.DesktopGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: 900px) {
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }
  @media (max-width: 600px) {
    display: none;
  }
`

/* Mobile layout — hidden on desktop */
F.MobileFooter = styled.div`
  display: none;

  @media (max-width: 600px) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }
`

F.MobileTop = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

F.MobileLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
`

F.MobileLink = styled(Link)`
  font-size: 11px;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.2s;

  &:hover { color: var(--accent); }
`

F.MobileDot = styled.span`
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.4;
`

F.Col = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`

F.ColTitle = styled.h4`
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
`

F.ColLinks = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

F.Disclaimer = styled.p`
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
  max-width: 320px;
  margin: 0;
`

F.Socials = styled.div`
  display: flex;
  gap: 6px;
`

F.TrustLine = styled.p`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;

  a { color: var(--text-secondary); text-decoration: none; }
  a:hover { color: var(--accent); }
`

F.SocialLink = styled.a`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all 0.2s;

  &:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
`

F.LinkItem = styled.p`
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s;
  margin: 0;

  &:hover { color: var(--accent); }
`

F.AzGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`

F.AzLink = styled(Link)`
  padding: 2px 5px;
  font-size: 11px;
  color: var(--text-secondary);
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
`

F.Bottom = styled.div`
  max-width: 1200px;
  margin: 1.5rem auto 0;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  text-align: center;

  @media (max-width: 600px) {
    display: none;
  }
`

F.Copyright = styled.p`
  font-size: 11px;
  color: var(--text-muted);
  margin: 0;
`
