import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { FaGithub, FaLock, FaPlayCircle, FaShieldAlt } from 'react-icons/fa'

const Strip = styled.section`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 20px 0;

  @media (max-width: 760px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 430px) { grid-template-columns: 1fr; }
`

const Item = styled(Link)`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 9px;
  align-items: center;
  min-height: 64px;
  padding: 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-card) 86%, transparent);
  color: inherit;
  text-decoration: none;
  transition: transform var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
  svg { color: var(--accent); }
  strong { display: block; color: var(--text-primary); font-size: 11px; }
  span { display: block; margin-top: 3px; color: var(--text-muted); font-size: 10px; line-height: 1.35; }
  &:hover { transform: translateY(-1px); border-color: var(--border-hover); background: var(--bg-elevated); }
  &:active { transform: scale(0.985); }
`

const TrustStrip = () => (
  <Strip aria-label="Aniraku trust and transparency">
    <Item to="/license"><FaGithub size={14} /><div><strong>Open source</strong><span>Inspect and self-host the client</span></div></Item>
    <Item to="/dmca"><FaPlayCircle size={14} /><div><strong>Client, not a media host</strong><span>Playback depends on third-party sources</span></div></Item>
    <Item to="/privacy"><FaLock size={14} /><div><strong>Your data, explained</strong><span>Guest storage and account sync are separate</span></div></Item>
    <Item to="/community-guidelines"><FaShieldAlt size={14} /><div><strong>Community standards</strong><span>Report abuse and keep discussion useful</span></div></Item>
  </Strip>
)

export default TrustStrip
