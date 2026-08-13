import React from "react"
import { FaAngleLeft, FaRandom, FaCog, FaShieldAlt } from "react-icons/fa"
import { Link, useNavigate } from "react-router-dom"
import { S } from "./sidebar.style"

const SideBar = ({ open, setOpen, profile, isAdmin }) => {
  const navigate = useNavigate()
  const clickHandler = (e) => {
    setOpen(false)
    const genre = e.currentTarget.textContent.trim()
    if (genre) navigate(`/catalog?genre=${encodeURIComponent(genre)}`)
  }
  return (
    <S.SideMenu open={open} id="sidebar-menu">
      <S.CloseButton onClick={() => setOpen(false)}>
        <FaAngleLeft /> Close menu
      </S.CloseButton>
      <S.SettingsIcon>
        <S.SettingsItem onClick={() => { setOpen(false); navigate('/random') }} style={{ cursor: 'pointer' }}>
          <FaRandom size={20} color="var(--accent)" />
          <p>Random</p>
        </S.SettingsItem>
        <S.SettingsItem>
          <Link to="/profile/settings" onClick={() => setOpen(false)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2em', color: 'var(--text-primary)', textDecoration: 'none' }}>
            <FaCog size={20} color="var(--accent)" />
            <p style={{ fontSize: 12 }}>Settings</p>
          </Link>
        </S.SettingsItem>
        {isAdmin && (
          <S.SettingsItem>
            <Link to="/admin" onClick={() => setOpen(false)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2em', color: 'var(--text-primary)', textDecoration: 'none' }}>
              <FaShieldAlt size={20} color="var(--accent)" />
              <p style={{ fontSize: 12 }}>Admin</p>
            </Link>
          </S.SettingsItem>
        )}
      </S.SettingsIcon>
      <S.NavList>
        <S.Item>
          <Link to="/home" onClick={() => setOpen(false)}>Home</Link>
        </S.Item>
        <S.Item>
          <Link to="/catalog" onClick={() => setOpen(false)}>Catalog</Link>
        </S.Item>
        <S.Item>
          <Link to="/schedule" onClick={() => setOpen(false)}>Schedule</Link>
        </S.Item>
        <S.Item>
          <p style={{ marginBottom: "1em" }}>Genre</p>
          <S.GenreList>
            <S.GenreItem type="button" onClick={clickHandler}>Action</S.GenreItem>
            <S.GenreItem type="button" onClick={clickHandler}>Adventure</S.GenreItem>
            <S.GenreItem type="button" onClick={clickHandler}>Comedy</S.GenreItem>
            <S.GenreItem type="button" onClick={clickHandler}>Drama</S.GenreItem>
            <S.GenreItem type="button" onClick={clickHandler}>Fantasy</S.GenreItem>
            <S.GenreItem type="button" onClick={clickHandler}>Horror</S.GenreItem>
            <S.GenreItem type="button" onClick={clickHandler}>Romance</S.GenreItem>
            <S.GenreItem type="button" onClick={clickHandler}>Sci-Fi</S.GenreItem>
            <S.GenreItem type="button" onClick={clickHandler}>Slice of Life</S.GenreItem>
            <S.GenreItem type="button" onClick={clickHandler}>Supernatural</S.GenreItem>
          </S.GenreList>
        </S.Item>
      </S.NavList>
    </S.SideMenu>
  )
}

export default SideBar
