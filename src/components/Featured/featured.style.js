import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const F = {}

F.Container = styled.div`
  max-width: 1400px;
  margin: 2rem auto;
  padding: 0 1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`
F.Card = styled.div``
F.CardBox = styled.div`
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
`
F.CardTitle = styled.h3`
  padding: 1rem 1.25rem;
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border);
`
F.CardList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`
F.CardItem = styled.li`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 1.25rem;
  transition: background 0.15s;
  &:nth-child(odd) { background: rgba(255,255,255,0.02); }
  &:hover { background: rgba(255,255,255,0.05); }
`
F.PosterDiv = styled.div`
  width: 45px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
`
F.Img = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`
F.DetailsWrapper = styled.div`
  flex: 1;
  min-width: 0;
`
F.Name = styled.p`
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  margin-bottom: 2px;
  &:hover { color: var(--accent); }
`
F.Details = styled.p`
  font-size: 0.75rem;
  color: var(--text-muted);
`
F.MoreLink = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 14px;
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 500;
  text-decoration: none;
  border-top: 1px solid var(--border);
  transition: color 0.2s;
  &:hover { color: var(--accent); }
`
