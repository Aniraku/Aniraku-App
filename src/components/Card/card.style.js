import styled from 'styled-components';

export const C = {};

C.Card = styled.div`
  position: relative;

  a { text-decoration: none; color: inherit; }
`;

C.Poster = styled.div`
  position: relative;
  width: 100%;
  padding-bottom: 140%;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-card);
  cursor: pointer;
  transition: transform var(--transition-normal);
  z-index: 1;

  &:active {
    transform: scale(0.97);
    transition: transform 0.1s;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      transform: scale(1.08);
      z-index: 10;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
    }
  }
`;

C.Image = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: brightness(0.85);
  transition: filter 0.3s, transform 0.3s;

  ${C.Poster}:hover & {
    filter: brightness(1) saturate(1.2);
    transform: scale(1.03);
  }
`;

C.Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.4);
  opacity: 0;
  transition: opacity 0.25s;
  z-index: 2;
  color: #fff;

  ${C.Poster}:hover & {
    opacity: 1;
  }

  @media (max-width: 768px) {
    opacity: 1;
    background: rgba(0,0,0,0.25);
  }
`;

C.BookmarkBtn = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transform: translateY(-4px);
  transition: all 0.25s;
  z-index: 3;
  border: none;

  ${C.Poster}:hover & {
    opacity: 1;
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    opacity: 1;
    transform: translateY(0);
    width: 44px;
    height: 44px;
    font-size: 14px;
  }

  &:hover {
    background: var(--media-color, var(--accent));
    color: #000;
  }
`;

C.Badges = styled.div`
  position: absolute;
  bottom: 8px;
  left: 8px;
  display: flex;
  gap: 4px;
  z-index: 3;
`;

C.Badge = styled.span`
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: ${({ accent }) => (accent ? 'var(--media-color, var(--accent))' : 'rgba(255,255,255,0.15)')};
  color: ${({ accent }) => (accent ? '#000' : '#fff')};
  backdrop-filter: blur(4px);
`;

C.EpBadge = styled.span`
  position: absolute;
  bottom: 8px;
  right: 8px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  color: #fff;
  z-index: 3;
`;

C.Details = styled.div`
  padding: 10px 4px 4px;
  transition: transform var(--transition-normal);

  @media (hover: hover) and (pointer: fine) {
    ${C.Poster}:hover + & {
      transform: translateY(4px);
    }
  }
`;

C.Preview = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 32px 10px 10px;
  background: linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.75) 60%, transparent 100%);
  opacity: 0;
  transform: translateY(10px);
  transition: opacity var(--transition-normal), transform var(--transition-normal);
  z-index: 4;
  pointer-events: none;

  @media (hover: hover) and (pointer: fine) {
    ${C.Poster}:hover & {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (hover: none) and (pointer: coarse) {
    display: none;
  }
`;

C.PreviewMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;

  span {
    font-size: 10px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    background: rgba(255,255,255,0.12);
    color: #fff;
  }
`;

C.PreviewAction = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  padding: 8px 0;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #000;
  cursor: pointer;
`;

C.Name = styled.h3`
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.4;
  font-weight: 500;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
  transition: color var(--transition-fast);

  &:hover {
    color: var(--media-color, var(--accent));
  }
`;
