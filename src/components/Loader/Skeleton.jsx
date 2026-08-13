import React from "react"
import NavBar from "../NavBar/NavBar"
import { L } from "./loader.style"

function Skeleton() {
  return (
    <>
      <NavBar />
      <L.Wrapper>
        {Array.from({ length: 8 }).map((_, i) => (
          <L.CardBlock key={i}>
            <L.Card />
            <L.CardBar />
          </L.CardBlock>
        ))}
      </L.Wrapper>
    </>
  )
}

export default Skeleton
