import styled from 'styled-components'

export const S = {}

S.SideMenu = styled.div`
  position: fixed;
  display: flex;
  flex-direction: column;
  top: 0;
  left: 0;
  height: 100dvh;
  width: 280px;
  background-color: #1a1c21;
  transform: ${({ open }) => (!open ? 'translateX(-300px)' : 'translateX(0)')};
  visibility: ${({ open }) => (open ? 'visible' : 'hidden')};
  pointer-events: ${({ open }) => (open ? 'auto' : 'none')};
  overflow-y: auto;
  overflow-x: hidden;
  gap: 0.5em;
  z-index: 300;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.3s;
  padding-top: env(safe-area-inset-top, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);

  @media only screen and (max-width: 768px) {
    width: 85vw;
    max-width: 320px;
  }
`

S.CloseButton = styled.button`
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(255,255,255,0.08);
  border: none;
  border-radius: 20px;
  width: fit-content;
  padding: 8px 16px;
  margin: 16px 16px 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  gap: 6px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(255,255,255,0.14);
  }
`
S.DonateBtn = styled.button`
  line-height: 36px;
  border-radius: 20px;
  /* width: 100%; */
  margin-inline: 1em;
  font-size: 13px;
  font-weight: 500;
  padding: 0 1rem;
  color: #000;
  background-color: #00ffb7;
`
S.CommunityBtn = styled.button`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.2em;
  line-height: 36px;
  border-radius: 20px;
  margin-inline: 1em;
  font-size: 13px;
  font-weight: 500;
  padding: 0 1rem;
  color: #fff;
  background-color: #222327;
`
S.SettingsIcon = styled.div`
  display: none;
  align-items: center;
  gap: 1em;
  background: rgba(255, 255, 255, 0.04);
  width: 100%;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  @media only screen and (max-width: 768px) {
    display: flex;
  }
`
S.SettingsItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 12px;
  color: #fff;
  gap: 0.2em;
`
S.NavList = styled.div`
  display: flex;
  flex-direction: column;
  padding: 8px 0;
`
S.Item = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  padding: 0;

  a {
    display: block;
    padding: 12px 16px;
    font-size: 15px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
    -webkit-tap-highlight-color: transparent;

    &:hover, &:active {
      background: rgba(255, 255, 255, 0.06);
      color: #fff;
    }
  }
`

S.GenreList = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 8px;
  padding: 4px 0 8px;
  font-size: 13px;
`
S.GenreItem = styled.button`
  padding: 8px 12px;
  margin: 0;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;

  &:hover, &:active {
    background: rgba(255, 255, 255, 0.06);
  }

  @media (hover: none) and (pointer: coarse) {
    min-height: 44px;
  }

  &:nth-of-type(7n + 1) {
    color: #d0e6a5;
  }
  &:nth-of-type(7n + 2) {
    color: #ffdd95;
  }
  &:nth-of-type(7n + 3) {
    color: #fc887b;
  }
  &:nth-of-type(7n + 4) {
    color: #ccabda;
  }
  &:nth-of-type(7n + 5) {
    color: #abccd8;
  }
  &:nth-of-type(7n + 6) {
    color: #d8b2ab;
  }
  &:nth-of-type(7n) {
    color: #86e3ce;
  }
`
