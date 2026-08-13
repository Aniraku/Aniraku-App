import React from 'react'
import img from '../assets/images/error.png'
import { E } from './error.style'
import { FaChevronCircleLeft } from 'react-icons/fa'
import { useEffect } from 'react'

const Error = () => {
  useEffect(() => {
    document.title = 'Page Not Found — Aniraku'
    // Ensure meta tags are updated for 404
    let metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute('content', 'Page not found on Aniraku — Free Anime Streaming. Browse our catalog to find anime.')
  }, [])

  return (
    <E.Container>
      <E.Img src={img} />
      <E.ErrorText>404 Error</E.ErrorText>
      <E.Text>Oops! We can't find this page.</E.Text>
      <E.BtnLink to="/home">
        <FaChevronCircleLeft />
        Back to homepage
      </E.BtnLink>
    </E.Container>
  )
}

export default Error
