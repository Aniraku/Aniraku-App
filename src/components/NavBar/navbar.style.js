import styled from 'styled-components'
import { Link } from 'react-router-dom'

export const N = {}

N.Nav = styled.nav`
  position: ${({ $isHome }) => ($isHome ? 'fixed' : 'sticky')};
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: calc(var(--header-h) + env(safe-area-inset-top, 0));
  padding: env(safe-area-inset-top, 0) 1.5rem 0;
  background: ${({ $isScrolled, $isHome }) =>
    $isHome
      ? $isScrolled
        ? 'rgba(0,0,0,0.85)'
        : 'transparent'
      : 'rgba(0,0,0,0.95)'};
  backdrop-filter: ${({ $isScrolled, $isHome }) => ($isHome && $isScrolled) ? 'blur(12px)' : 'none'};
  -webkit-backdrop-filter: ${({ $isScrolled, $isHome }) => ($isHome && $isScrolled) ? 'blur(12px)' : 'none'};
  border-bottom: 1px solid ${({ $isScrolled, $isHome }) =>
    $isHome && $isScrolled ? 'rgba(255,255,255,0.06)' : 'transparent'};
  transition: background 0.3s, backdrop-filter 0.3s, border-color 0.3s;
  z-index: 100;
  gap: 1rem;

  ${({ $nativeAndroid }) => $nativeAndroid && `
    display: none;
  `}

  @media (max-width: 768px) {
    display: none;
  }
`

N.Left = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
`

N.MenuBtn = styled.button`
  display: none;
  background: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);

  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &:hover {
    color: var(--accent);
  }
`

N.SearchForm = styled.form`
  display: flex;
  align-items: center;
  gap: 6px;
  width: 200px;
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-muted);
  transition: border-color 0.15s;

  &:focus-within { border-color: var(--accent); }

  @media (max-width: 768px) { display: none; }
`

N.SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  background: none;
  outline: none;
  color: var(--text-primary);
  font-size: 13px;

  &::placeholder { color: var(--text-muted); }
`

N.NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;

  @media (max-width: 768px) { display: none; }
`

N.NavLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: color var(--transition-fast), background var(--transition-fast);
  white-space: nowrap;

  &:hover { color: var(--accent); background: rgba(255,255,255,0.04); }
  &.active { color: var(--accent); }

  span { font-size: 12px; }

  @media (max-width: 900px) { padding: 6px 10px; span { display: none; } }
`

N.Right = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;

  @media (max-width: 768px) {
    gap: 0;
  }
`

N.RightBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  transition: color var(--transition-fast);

  &:hover { color: var(--accent); }

  @media (max-width: 768px) { display: none; }
`



N.Divider = styled.div`
  width: 1px;
  height: 24px;
  background: var(--border);
  margin: 0 4px;

  @media (max-width: 768px) {
    display: none;
  }
`

N.Avatar = styled.img`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--accent);
  cursor: pointer;
  transition: transform var(--transition-fast);

  &:hover {
    transform: scale(1.05);
  }

  @media (max-width: 768px) {
    width: 30px;
    height: 30px;
  }
`

N.SignIn = styled.span`
  padding: 6px 16px;
  background: var(--accent);
  color: #000;
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity var(--transition-fast);

  &:hover {
    opacity: 0.9;
  }

  @media (max-width: 768px) {
    padding: 5px 12px;
    font-size: 12px;
  }
`

N.LayoutBg = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 250;
  display: ${({ open }) => (open ? 'block' : 'none')};
`
