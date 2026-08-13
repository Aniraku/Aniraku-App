import styled, { keyframes } from "styled-components";

const shimmer = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

const Base = styled.div`
  background: linear-gradient(
    100deg,
    var(--bg-elevated) 35%,
    var(--bg-card) 50%,
    var(--bg-elevated) 65%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.1s ease-in-out infinite;
  border-radius: var(--radius-md, 8px);
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const L = {};

L.Skeleton = Base;

L.Hero = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2em;
  justify-content: center;
  padding: 0 2em;
  width: 100%;
  height: 600px;
  align-items: start;
  @media screen and (max-width: 1400px) {
    height: 570px;
  }
  @media screen and (max-width: 1299px) {
    height: 500px;
  }
  @media screen and (max-width: 768px) {
    height: 380px;
    padding: 0 1.25em;
  }
`;

L.Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1em;
  width: min(460px, 80%);
`;

L.Rank = styled.div`
  width: 44px;
  height: 18px;
  border-radius: var(--radius-full, 999px);
`;

L.Title = styled.div`
  width: min(420px, 70%);
  height: 36px;
  border-radius: var(--radius-md, 8px);
`;

L.Desc = styled.div`
  width: 100%;
  height: 12px;
  border-radius: var(--radius-md, 8px);
`;

L.DescShort = styled(L.Desc)`
  width: 60%;
`;

L.CTA = styled.div`
  width: 150px;
  height: 46px;
  border-radius: var(--radius-full, 999px);
`;

L.SectionTitle = styled.div`
  width: 160px;
  height: 22px;
  border-radius: var(--radius-md, 8px);
`;

L.Wrapper = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1.5em;
  margin: 1.5em 2em 2em;
  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    margin: 1.25em;
    gap: 1em;
  }
`;

L.Card = styled(Base)`
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-lg, 12px);
`;

L.CardBar = styled(Base)`
  width: 70%;
  height: 12px;
  margin-top: 10px;
  border-radius: var(--radius-md, 8px);
`;

L.CardBlock = styled.div`
  display: flex;
  flex-direction: column;
`;
