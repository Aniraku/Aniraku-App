import { Link } from 'react-router-dom'
import styled from 'styled-components'

export const E = {}

E.Container = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.6em;
  background: hsl(228, 7%, 14%);
`
E.Img = styled.img`
  max-height: 300px;
  max-width: 100%;
`

E.ErrorText = styled.p`
  font-size: 30px;
  font-weight: 400;
  line-height: 1.2em;
  margin-bottom: 10px;
  color: #fff;

  @media (max-width: 768px) {
    font-size: 24px;
  }
  @media (max-width: 480px) {
    font-size: 20px;
  }
`

E.Text = styled.p`
  font-size: 14px;
  font-weight: 400;
  line-height: 1.3em;
  margin-bottom: 30px;
  color: #fff;
`

E.BtnLink = styled(Link)`
  background: var(--accent);
  color: #111;
  border-color: var(--accent);
  padding: 0.6em 0.6em;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 0.5em;
`
