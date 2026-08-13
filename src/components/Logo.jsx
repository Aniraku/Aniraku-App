import React from 'react'
import { Link } from 'react-router-dom'

const Logo = ({ to = '/home', height = 40, showText = false, style = {} }) => {
  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        textDecoration: 'none',
        fontFamily: "'Agbalumo', cursive",
        ...style,
      }}
      aria-label="Aniraku home"
    >
      <span
        style={{
          fontSize: height > 36 ? '1.5rem' : '1.2rem',
          fontWeight: 800,
          letterSpacing: 1,
          color: 'var(--accent)',
          fontFamily: "'Agbalumo', cursive",
        }}
      >
        ANIRAKU
      </span>
    </Link>
  )
}

export default Logo
